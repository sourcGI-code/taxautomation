import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/notifications";
import { logComplianceEvent } from "@/lib/soc2/events";
import { buildMefPackage, generateSubmissionId, redactSsnInXml } from "./package";
import { transmitMefPackage } from "./transmit";
import { assertProductionMefReady, validateMefReturn } from "./validate";
import type { MefReturnPayload, MefSubmissionRow, MefEnvironment } from "./types";
import { getDefaultTaxYear } from "@/lib/tax-year";

function envDefault(): MefEnvironment {
  return process.env.IRS_MEF_PRODUCTION === "true" &&
    assertProductionMefReady().ok
    ? "production"
    : "sandbox";
}

export async function createMefDraft(input: {
  clientId: string;
  payload: MefReturnPayload;
  preparedBy: string;
}): Promise<MefSubmissionRow> {
  const validation = validateMefReturn(input.payload);
  const efin = process.env.IRS_EFIN || input.payload.preparer.efin || "000000";
  const etin = process.env.IRS_ETIN || "00000";
  const submissionId = generateSubmissionId(efin);
  const environment = envDefault();

  const { returnXml, manifestXml } = buildMefPackage(input.payload, {
    submissionId,
    efin,
    etin,
    environment,
  });

  const status = validation.ok ? "validated" : "draft";
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("mef_submissions")
    .insert({
      client_id: input.clientId,
      tax_year: input.payload.taxYear || getDefaultTaxYear(),
      form_type: input.payload.formType,
      submission_id: submissionId,
      status,
      package_xml: returnXml,
      manifest_xml: manifestXml,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings,
      efin,
      etin,
      environment,
      prepared_by: input.preparedBy,
      metadata: {
        taxpayer_name: `${input.payload.taxpayer.firstName} ${input.payload.taxpayer.lastName}`,
        filing_status: input.payload.taxpayer.filingStatus,
        content_hash_preview: true,
      },
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from("clients")
    .update({
      mef_submission_id: data.id,
      efile_status: status,
      updated_at: now,
    })
    .eq("id", input.clientId);

  await logActivity({
    clientId: input.clientId,
    action: "mef_draft_created",
    description: `MeF ${status} package ${submissionId} (${environment})`,
    metadata: {
      submission_id: submissionId,
      errors: validation.errors.length,
      warnings: validation.warnings.length,
    },
  });

  await logComplianceEvent({
    eventType: "mef.package",
    action: "create_draft",
    controlId: "CC6.1",
    clientId: input.clientId,
    actorType: "staff",
    actorId: input.preparedBy,
    description: `MeF package created (${environment})`,
    metadata: { submission_id: submissionId, status },
  });

  return data as MefSubmissionRow;
}

export async function transmitMefSubmission(input: {
  submissionRowId: string;
  staffName: string;
  forceSandbox?: boolean;
}): Promise<MefSubmissionRow> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("mef_submissions")
    .select("*")
    .eq("id", input.submissionRowId)
    .single();

  if (error || !row) throw new Error("MeF submission not found");
  if (!row.package_xml || !row.manifest_xml) {
    throw new Error("Package XML missing — rebuild draft first");
  }
  if (row.status === "accepted") {
    throw new Error("Submission already accepted");
  }
  if ((row.validation_errors as unknown[])?.length > 0 && row.status === "draft") {
    throw new Error("Fix validation errors before transmit");
  }

  await supabase
    .from("mef_submissions")
    .update({ status: "transmitting", updated_at: new Date().toISOString() })
    .eq("id", row.id);

  const result = await transmitMefPackage({
    submissionId: row.submission_id,
    returnXml: row.package_xml,
    manifestXml: row.manifest_xml,
    forceSandbox: input.forceSandbox,
  });

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: result.status === "transmitting" ? "transmitting" : result.status,
    transmission_id: result.transmissionId,
    ack_xml: result.ackXml,
    ack_code: result.ackCode,
    ack_message: result.ackMessage,
    environment: result.environment,
    transmitted_at: now,
    updated_at: now,
    metadata: {
      ...(typeof row.metadata === "object" && row.metadata ? row.metadata : {}),
      last_transmit_raw: result.raw?.slice(0, 500),
    },
  };
  if (result.status === "accepted") updates.accepted_at = now;
  if (result.status === "rejected") updates.rejected_at = now;

  const { data: updated, error: upErr } = await supabase
    .from("mef_submissions")
    .update(updates)
    .eq("id", row.id)
    .select()
    .single();

  if (upErr) throw upErr;

  const clientUpdates: Record<string, unknown> = {
    efile_status: updated.status,
    mef_submission_id: updated.id,
    updated_at: now,
  };
  if (result.status === "accepted") {
    clientUpdates.status = "filed";
  }

  await supabase.from("clients").update(clientUpdates).eq("id", row.client_id);

  await logActivity({
    clientId: row.client_id,
    action: "mef_transmitted",
    description: `MeF ${result.status}: ${result.ackMessage}`,
    metadata: {
      submission_id: result.submissionId,
      transmission_id: result.transmissionId,
      environment: result.environment,
      ack_code: result.ackCode,
    },
  });

  await logComplianceEvent({
    eventType: "mef.transmit",
    severity: result.ok ? "info" : "high",
    action: result.status,
    controlId: "CC7.2",
    clientId: row.client_id,
    actorType: "staff",
    actorId: input.staffName,
    description: `MeF transmit ${result.environment}: ${result.status}`,
    metadata: {
      submission_id: result.submissionId,
      ack_code: result.ackCode,
    },
  });

  return updated as MefSubmissionRow;
}

export async function listMefForClient(clientId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mef_submissions")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return (data || []).map((row) => ({
    ...row,
    package_xml: row.package_xml ? redactSsnInXml(row.package_xml) : null,
    manifest_xml: row.manifest_xml ? redactSsnInXml(row.manifest_xml) : null,
  }));
}

export function mefConfigStatus() {
  const prod = assertProductionMefReady();
  return {
    environment: envDefault(),
    sandboxAvailable: true,
    productionReady: prod.ok,
    productionGaps: prod.gaps,
    efinConfigured: !!process.env.IRS_EFIN,
    etinConfigured: !!process.env.IRS_ETIN,
    endpointConfigured: !!process.env.IRS_MEF_ENDPOINT,
  };
}
