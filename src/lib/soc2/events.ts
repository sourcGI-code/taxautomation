import { createAdminClient } from "@/lib/supabase/admin";

export type ComplianceSeverity = "info" | "low" | "medium" | "high" | "critical";

/**
 * Append-only style compliance/security event for SOC 2 evidence.
 * Failures are logged to console — never block primary user flows hard.
 */
export async function logComplianceEvent(input: {
  eventType: string;
  action: string;
  description?: string;
  controlId?: string;
  severity?: ComplianceSeverity;
  actorType?: string;
  actorId?: string;
  actorEmail?: string;
  clientId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("compliance_events").insert({
      event_type: input.eventType,
      severity: input.severity || "info",
      actor_type: input.actorType || null,
      actor_id: input.actorId || null,
      actor_email: input.actorEmail || null,
      client_id: input.clientId || null,
      control_id: input.controlId || null,
      action: input.action,
      description: input.description || null,
      ip: input.ip || null,
      user_agent: input.userAgent || null,
      metadata: input.metadata || {},
    });
    if (error) {
      console.warn("compliance_events insert failed (run migration 007?):", error.message);
    }
  } catch (err) {
    console.warn("logComplianceEvent error:", err);
  }
}

export async function recordControlEvidence(input: {
  controlId: string;
  evidenceType: string;
  title: string;
  description?: string;
  status?: "collected" | "reviewed" | "gap" | "remediated";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("soc2_control_evidence").upsert(
      {
        control_id: input.controlId,
        evidence_type: input.evidenceType,
        title: input.title,
        description: input.description || null,
        status: input.status || "collected",
        collected_at: new Date().toISOString(),
        metadata: input.metadata || {},
      },
      { onConflict: "control_id,evidence_type,title" }
    );
  } catch (err) {
    console.warn("recordControlEvidence error:", err);
  }
}
