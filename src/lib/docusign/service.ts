import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/notifications";
import { logComplianceEvent } from "@/lib/soc2/events";
import {
  createEnvelope,
  getEnvelopeStatus,
  isDocuSignConfigured,
  mapDocuSignStatus,
  docusignConfigStatus,
} from "./client";
/** Minimal valid PDF for DocuSign document when no return draft exists */
function minimalPdfBase64(title: string, clientName: string): string {
  // Tiny PDF with text (binary as latin1 string then base64)
  const content = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 12 Tf 72 720 Td (${title.replace(/[()\\]/g, "")} - ${clientName.replace(/[()\\]/g, "")}) Tj ET
endstream endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000384 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
459
%%EOF`;
  return Buffer.from(content, "utf8").toString("base64");
}

export async function sendTaxReturnForDocuSign(input: {
  clientId: string;
  clientEmail: string;
  clientName: string;
  taxYear: number;
  staffName: string;
  documentBase64?: string;
  documentName?: string;
  embedded?: boolean;
}): Promise<{
  envelopeId: string;
  status: string;
  signingUrl?: string;
  simulated: boolean;
  rowId: string;
}> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const subject = `${process.env.NEXT_PUBLIC_PRACTICE_NAME || "Tax Practice"} — Sign your ${input.taxYear} tax return`;
  const docB64 =
    input.documentBase64 ||
    minimalPdfBase64(`${input.taxYear} Tax Return Authorization`, input.clientName);

  const result = await createEnvelope({
    signerEmail: input.clientEmail,
    signerName: input.clientName,
    subject,
    emailBlurb:
      "Please review and electronically sign your tax return authorization. This uses DocuSign for a certified electronic signature with full audit trail and Certificate of Completion.",
    documentBase64: docB64,
    documentName: input.documentName || `${input.taxYear}_tax_return_authorization.pdf`,
    documentExtension: "pdf",
    clientUserId: input.embedded ? input.clientId : undefined,
    returnUrl: `${appUrl}/portal?docusign=complete`,
  });

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const mapped = mapDocuSignStatus(result.status);

  const { data, error } = await supabase
    .from("docusign_envelopes")
    .insert({
      client_id: input.clientId,
      envelope_id: result.envelopeId,
      status: mapped === "error" ? "sent" : mapped,
      subject,
      signer_email: input.clientEmail,
      signer_name: input.clientName,
      document_name: input.documentName || `${input.taxYear}_tax_return_authorization.pdf`,
      signing_url: result.signingUrl || null,
      environment: result.environment,
      metadata: {
        simulated: result.simulated,
        staff: input.staffName,
        docusign_configured: isDocuSignConfigured(),
      },
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from("clients")
    .update({
      docusign_envelope_id: result.envelopeId,
      docusign_status: mapped,
      status: "ready_for_signature",
      updated_at: now,
    })
    .eq("id", input.clientId);

  await logActivity({
    clientId: input.clientId,
    action: "docusign_envelope_sent",
    description: result.simulated
      ? `DocuSign simulator envelope ${result.envelopeId} created`
      : `DocuSign envelope ${result.envelopeId} sent`,
    metadata: {
      envelope_id: result.envelopeId,
      simulated: result.simulated,
      environment: result.environment,
    },
  });

  await logComplianceEvent({
    eventType: "docusign.envelope",
    action: "sent",
    controlId: "CC6.6",
    clientId: input.clientId,
    actorType: "staff",
    actorId: input.staffName,
    description: `DocuSign envelope sent (${result.environment}${result.simulated ? ", simulated" : ""})`,
    metadata: { envelope_id: result.envelopeId },
  });

  return {
    envelopeId: result.envelopeId,
    status: mapped,
    signingUrl: result.signingUrl,
    simulated: result.simulated,
    rowId: data.id,
  };
}

export async function markDocuSignCompleted(input: {
  envelopeId: string;
  eventStatus: string;
  webhookPayload?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const mapped = mapDocuSignStatus(input.eventStatus);
  const now = new Date().toISOString();

  const { data: row } = await supabase
    .from("docusign_envelopes")
    .select("*")
    .eq("envelope_id", input.envelopeId)
    .maybeSingle();

  if (!row) return null;

  const events = Array.isArray(row.webhook_events) ? row.webhook_events : [];
  events.push({
    at: now,
    status: input.eventStatus,
    payload: input.webhookPayload
      ? { status: input.eventStatus }
      : undefined,
  });

  const updates: Record<string, unknown> = {
    status: mapped,
    webhook_events: events,
    updated_at: now,
  };
  if (mapped === "completed" || mapped === "signed") {
    updates.completed_at = now;
  }
  if (mapped === "voided" || mapped === "declined") {
    updates.voided_at = now;
  }

  await supabase
    .from("docusign_envelopes")
    .update(updates)
    .eq("id", row.id);

  const clientUpdates: Record<string, unknown> = {
    docusign_status: mapped,
    updated_at: now,
  };

  if (mapped === "completed" || mapped === "signed") {
    clientUpdates.signature_acknowledged_at = now;
    clientUpdates.signed_at = now;
    clientUpdates.signature_method = "docusign";
    clientUpdates.signature_typed_name = row.signer_name;
  }

  await supabase.from("clients").update(clientUpdates).eq("id", row.client_id);

  await logActivity({
    clientId: row.client_id,
    action: "docusign_status",
    description: `DocuSign envelope ${input.envelopeId} → ${mapped}`,
    metadata: { envelope_id: input.envelopeId, status: mapped },
  });

  await logComplianceEvent({
    eventType: "docusign.status",
    action: mapped,
    controlId: "CC6.6",
    clientId: row.client_id,
    actorType: "system",
    description: `DocuSign status ${mapped}`,
    metadata: { envelope_id: input.envelopeId },
    severity: mapped === "declined" ? "medium" : "info",
  });

  // Record local e_signatures row for unified audit
  if (mapped === "completed" || mapped === "signed") {
    await supabase.from("e_signatures").insert({
      client_id: row.client_id,
      typed_name: row.signer_name,
      method: "docusign",
      consent_text:
        "Signed via DocuSign eSignature platform with Certificate of Completion retained by DocuSign and mirrored in firm records.",
      signature_data_url: null,
      ip: null,
      user_agent: "docusign-connect",
      signed_at: now,
    });
  }

  return { clientId: row.client_id, status: mapped };
}

export async function refreshEnvelope(envelopeId: string) {
  const status = await getEnvelopeStatus(envelopeId);
  return markDocuSignCompleted({
    envelopeId,
    eventStatus: status.status,
  });
}

export async function completeSimulatedSigning(envelopeId: string) {
  if (!envelopeId.startsWith("SIM-")) {
    throw new Error("Only simulator envelopes can be completed this way");
  }
  return markDocuSignCompleted({
    envelopeId,
    eventStatus: "completed",
  });
}

export { docusignConfigStatus, isDocuSignConfigured };
