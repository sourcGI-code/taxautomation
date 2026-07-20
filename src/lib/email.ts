import { Resend } from "resend";
import { getPracticeConfig } from "./templates/email-layout";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export interface EmailConfig {
  configured: boolean;
  fromEmail: string;
  practiceName: string;
  mode: "live" | "dev";
}

export function getEmailConfig(): EmailConfig {
  const practice = getPracticeConfig();
  return {
    configured: !!process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL || "onboarding@resend.dev",
    practiceName: practice.name,
    mode: process.env.RESEND_API_KEY ? "live" : "dev",
  };
}

export async function sendEmail({
  to,
  subject,
  html,
  clientId,
}: {
  to: string;
  subject: string;
  html: string;
  clientId?: string;
}) {
  const resend = getResend();
  const config = getEmailConfig();

  if (!resend) {
    console.log("\n" + "=".repeat(60));
    console.log(`[EMAIL DEV MODE] To: ${to}`);
    console.log(`Subject: ${subject}`);
    if (clientId) console.log(`Client ID: ${clientId}`);
    console.log("=".repeat(60) + "\n");
    return { id: "dev-mode", success: true };
  }

  const result = await resend.emails.send({
    from: `${config.practiceName} <${config.fromEmail}>`,
    to,
    subject,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  console.log(`[EMAIL SENT] To: ${to} | ID: ${result.data?.id}`);
  return { id: result.data?.id, success: true, clientId };
}

export async function testResendConnection(): Promise<{ ok: boolean; message: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, message: "RESEND_API_KEY not set — running in dev mode (emails log to console)" };
  }

  try {
    const resend = getResend()!;
    // Resend doesn't have a ping endpoint; validate key format
    if (!process.env.RESEND_API_KEY.startsWith("re_")) {
      return { ok: false, message: "RESEND_API_KEY appears invalid (should start with re_)" };
    }
    return { ok: true, message: `Resend configured. From: ${getEmailConfig().fromEmail}` };
  } catch (err) {
    return { ok: false, message: `Resend error: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// Re-export template helpers for backward compatibility
export { getPortalUrl } from "./utils-portal";
