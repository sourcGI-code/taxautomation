import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { canChangeClientStatus } from "@/lib/staff";
import { assertSameOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  docusignConfigStatus,
  refreshEnvelope,
  sendTaxReturnForDocuSign,
} from "@/lib/docusign/service";
import { getDefaultTaxYear } from "@/lib/tax-year";

const sendSchema = z.object({
  clientId: z.string().uuid(),
  embedded: z.boolean().optional(),
  documentBase64: z.string().max(15_000_000).optional(),
  documentName: z.string().max(200).optional(),
});

export async function GET(request: NextRequest) {
  const staff = await getAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get("clientId");
  const config = docusignConfigStatus();

  if (!clientId) {
    return NextResponse.json({ config });
  }

  const supabase = createAdminClient();
  const { data: envelopes } = await supabase
    .from("docusign_envelopes")
    .select(
      "id,envelope_id,status,subject,signer_email,signer_name,signing_url,environment,completed_at,created_at,metadata"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ config, envelopes: envelopes || [] });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const staff = await getAdminSession();
  if (!staff || !canChangeClientStatus(staff.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "send") {
      const data = sendSchema.parse(body);
      const supabase = createAdminClient();
      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("id", data.clientId)
        .single();
      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }

      const result = await sendTaxReturnForDocuSign({
        clientId: client.id,
        clientEmail: client.email,
        clientName: client.name,
        taxYear: client.tax_year || getDefaultTaxYear(),
        staffName: staff.name,
        documentBase64: data.documentBase64,
        documentName: data.documentName,
        embedded: data.embedded ?? true,
      });

      return NextResponse.json({
        success: true,
        ...result,
        config: docusignConfigStatus(),
      });
    }

    if (action === "refresh") {
      const envelopeId = z.string().min(3).parse(body.envelopeId);
      const updated = await refreshEnvelope(envelopeId);
      return NextResponse.json({ success: true, result: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("DocuSign admin error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DocuSign failed" },
      { status: 500 }
    );
  }
}
