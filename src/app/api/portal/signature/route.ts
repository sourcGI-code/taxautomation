import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/notifications";
import { assertSameOrigin } from "@/lib/security";
import { getClientIp } from "@/lib/rate-limit";
import {
  DEFAULT_CONSENT,
  buildSignatureAudit,
  validateSignatureInput,
} from "@/lib/esign";
import { z } from "zod";

const bodySchema = z.object({
  typedName: z.string().min(2).max(120),
  agreedToElectronicSignature: z.literal(true),
  signatureDataUrl: z.string().max(400_000).optional().nullable(),
  consentText: z.string().max(2000).optional(),
});

/**
 * Full electronic signature with typed name, optional drawn signature,
 * consent text, IP + user-agent audit trail, and e_signatures row.
 */
export async function POST(request: NextRequest) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await getAuthenticatedClient();
    if (!client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (client.status !== "ready_for_signature") {
      return NextResponse.json(
        { error: "Return is not ready for signature yet" },
        { status: 400 }
      );
    }

    if (client.signed_at || client.signature_acknowledged_at) {
      return NextResponse.json({
        success: true,
        alreadySigned: true,
        signed_at: client.signed_at || client.signature_acknowledged_at,
      });
    }

    const raw = await request.json();
    const parsed = bodySchema.parse(raw);

    const validated = validateSignatureInput({
      typedName: parsed.typedName,
      clientLegalName: client.name,
      agreedToElectronicSignature: parsed.agreedToElectronicSignature,
      signatureDataUrl: parsed.signatureDataUrl,
      consentText: parsed.consentText || DEFAULT_CONSENT,
    });

    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || "unknown";
    const now = new Date().toISOString();
    const audit = buildSignatureAudit({
      clientId: client.id,
      ip,
      userAgent,
      valid: validated.value,
    });

    const supabase = createAdminClient();

    // Immutable audit row (best-effort if migration not applied yet)
    const { error: sigInsertError } = await supabase.from("e_signatures").insert({
      client_id: client.id,
      typed_name: validated.value.typedName,
      method: validated.value.method,
      consent_text: validated.value.consentText,
      signature_data_url: validated.value.signatureDataUrl,
      ip,
      user_agent: userAgent.slice(0, 500),
      signed_at: now,
    });

    if (sigInsertError) {
      console.warn("e_signatures insert failed (run migration 006?):", sigInsertError.message);
    }

    const { data: updated, error } = await supabase
      .from("clients")
      .update({
        signature_acknowledged_at: now,
        signed_at: now,
        signature_typed_name: validated.value.typedName,
        signature_method: validated.value.method,
        signature_ip: ip,
        signature_user_agent: userAgent.slice(0, 500),
        // Stay ready_for_signature until staff marks filed after IRS submission
        updated_at: now,
      })
      .eq("id", client.id)
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      clientId: client.id,
      action: "e_signature_completed",
      description: `Electronic signature by ${validated.value.typedName} — pending staff filing`,
      metadata: { ...audit, signature_data_omitted: true },
    });

    return NextResponse.json({
      success: true,
      client: updated,
      signed_at: now,
      method: validated.value.method,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Signature error:", error);
    return NextResponse.json({ error: "Failed to record signature" }, { status: 500 });
  }
}

export async function GET() {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    consentText: DEFAULT_CONSENT,
    status: client.status,
    signed_at: client.signed_at || client.signature_acknowledged_at,
    signature_typed_name: client.signature_typed_name,
  });
}
