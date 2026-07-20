import twilio from "twilio";
import { getPracticeConfig } from "./templates/email-layout";

let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilio() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

export interface SmsConfig {
  configured: boolean;
  fromNumber: string;
  mode: "live" | "dev";
}

export function getSmsConfig(): SmsConfig {
  return {
    configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
    fromNumber: process.env.TWILIO_PHONE_NUMBER || "",
    mode: process.env.TWILIO_ACCOUNT_SID ? "live" : "dev",
  };
}

export function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

export async function sendSms({ to, body }: { to: string; body: string }) {
  const client = getTwilio();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!client || !fromNumber) {
    console.log("\n" + "=".repeat(60));
    console.log(`[SMS DEV MODE] To: ${to}`);
    console.log(body);
    console.log("=".repeat(60) + "\n");
    return { sid: "dev-mode", success: true };
  }

  const formattedTo = formatPhoneE164(to);

  const message = await client.messages.create({
    body,
    from: fromNumber,
    to: formattedTo,
  });

  console.log(`[SMS SENT] To: ${formattedTo} | SID: ${message.sid}`);
  return { sid: message.sid, success: true };
}

export async function testTwilioConnection(): Promise<{ ok: boolean; message: string }> {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    return { ok: false, message: "TWILIO_ACCOUNT_SID not set — running in dev mode (SMS logs to console)" };
  }
  if (!process.env.TWILIO_AUTH_TOKEN) {
    return { ok: false, message: "TWILIO_AUTH_TOKEN not set" };
  }
  if (!process.env.TWILIO_PHONE_NUMBER) {
    return { ok: false, message: "TWILIO_PHONE_NUMBER not set" };
  }

  try {
    const client = getTwilio()!;
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
    return {
      ok: true,
      message: `Twilio connected. Account: ${account.friendlyName} | From: ${process.env.TWILIO_PHONE_NUMBER}`,
    };
  } catch (err) {
    return { ok: false, message: `Twilio error: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// Re-export SMS templates for backward compatibility
export { smsTemplates } from "./templates/sms";

// Legacy function aliases
import { smsTemplates } from "./templates/sms";

export const bookingConfirmationSms = smsTemplates.bookingConfirmation;
export const statusUpdateSms = smsTemplates.statusUpdate;
export const reminderSms = smsTemplates.customReminder;
export const appointmentReminderSms = smsTemplates.appointmentReminder;
