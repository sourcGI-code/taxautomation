import { NextRequest, NextResponse } from "next/server";
import { verifyDocuSignConnectHmac } from "@/lib/docusign/client";
import { markDocuSignCompleted } from "@/lib/docusign/service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * DocuSign Connect webhook.
 * Configure Connect to POST envelope events to /api/webhooks/docusign
 * with HMAC secret DOCUSIGN_CONNECT_SECRET.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit(`docusign-hook:${ip}`, 120, 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const raw = await request.text();
    const sig =
      request.headers.get("x-docusign-signature-1") ||
      request.headers.get("X-DocuSign-Signature-1");

    if (!verifyDocuSignConnectHmac(raw, sig)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Support both Connect JSON shapes
    const envelopeId =
      (payload.envelopeId as string) ||
      ((payload.data as Record<string, unknown>)?.envelopeId as string) ||
      (payload.EnvelopeStatus as Record<string, unknown>)?.EnvelopeID;

    const status =
      (payload.status as string) ||
      ((payload.data as Record<string, unknown>)?.envelopeSummary as Record<string, unknown>)
        ?.status ||
      (payload.EnvelopeStatus as Record<string, unknown>)?.Status ||
      "unknown";

    if (!envelopeId || typeof envelopeId !== "string") {
      return NextResponse.json({ error: "envelopeId required" }, { status: 400 });
    }

    await markDocuSignCompleted({
      envelopeId,
      eventStatus: String(status),
      webhookPayload: payload,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("DocuSign webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
