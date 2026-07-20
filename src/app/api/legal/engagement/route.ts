import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth";
import { engagementLetterText } from "@/lib/legal/documents";
import { getDefaultTaxYear } from "@/lib/tax-year";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordClientConsent } from "@/lib/consent";
import { assertSameOrigin } from "@/lib/security";
import { getClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/notifications";

export async function GET() {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = client.tax_year || getDefaultTaxYear();
  const text = engagementLetterText(client.name, year);
  return NextResponse.json({
    text,
    taxYear: year,
    acceptedAt: client.engagement_accepted_at || null,
  });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();
  await supabase
    .from("clients")
    .update({ engagement_accepted_at: now, updated_at: now })
    .eq("id", client.id);

  await recordClientConsent({
    clientId: client.id,
    consentType: "engagement",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") || undefined,
  });

  await logActivity({
    clientId: client.id,
    action: "engagement_accepted",
    description: "Client accepted engagement letter",
  });

  return NextResponse.json({ success: true, acceptedAt: now });
}
