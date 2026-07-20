import { createAdminClient } from "./supabase/admin";
import { logComplianceEvent } from "./soc2/events";

export const CONSENT_VERSION = "2026-07-20";

export type ConsentType =
  | "privacy"
  | "terms"
  | "electronic_comms"
  | "esign_disclosure"
  | "engagement";

export async function recordClientConsent(input: {
  clientId: string;
  consentType: ConsentType;
  version?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("client_consents").insert({
    client_id: input.clientId,
    consent_type: input.consentType,
    version: input.version || CONSENT_VERSION,
    ip: input.ip || null,
    user_agent: input.userAgent?.slice(0, 500) || null,
    metadata: input.metadata || {},
  });

  if (error) {
    console.warn("recordClientConsent failed:", error.message);
    return;
  }

  await logComplianceEvent({
    eventType: "consent.recorded",
    action: input.consentType,
    controlId: "P1.1",
    clientId: input.clientId,
    actorType: "client",
    ip: input.ip,
    userAgent: input.userAgent,
    description: `Consent ${input.consentType} v${input.version || CONSENT_VERSION}`,
  });
}

export async function recordBookingConsents(input: {
  clientId: string;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  const types: ConsentType[] = [
    "privacy",
    "terms",
    "electronic_comms",
    "esign_disclosure",
  ];
  for (const consentType of types) {
    await recordClientConsent({
      clientId: input.clientId,
      consentType,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }
}
