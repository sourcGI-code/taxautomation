import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeSimulatedSigning } from "@/lib/docusign/service";
import { z } from "zod";

export async function GET() {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: envelopes } = await supabase
    .from("docusign_envelopes")
    .select(
      "id,envelope_id,status,subject,signing_url,environment,completed_at,created_at"
    )
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    envelopes: envelopes || [],
    docusign_status: client.docusign_status,
    signed_at: client.signed_at,
  });
}

const completeSchema = z.object({
  envelopeId: z.string().min(3),
  action: z.literal("complete_sim"),
});

/** Complete DocuSign simulator envelopes from the portal */
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = completeSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: env } = await supabase
      .from("docusign_envelopes")
      .select("*")
      .eq("envelope_id", body.envelopeId)
      .eq("client_id", client.id)
      .maybeSingle();

    if (!env) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    const result = await completeSimulatedSigning(body.envelopeId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 }
    );
  }
}
