import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify Cal.com webhook signature when CAL_WEBHOOK_SECRET is set.
 * Cal.com sends: x-cal-signature-256 = HMAC-SHA256 hex of raw body
 */
export function verifyCalWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) {
    // Not configured: allow in non-production for local testing
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[webhooks] CAL_WEBHOOK_SECRET not set — rejecting Cal webhooks in production"
      );
      return false;
    }
    return true;
  }

  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  // Header may be "sha256=<hex>" or raw hex
  const provided = signatureHeader.replace(/^sha256=/, "").trim();

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(provided, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
