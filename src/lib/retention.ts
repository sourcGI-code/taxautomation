import { createAdminClient } from "./supabase/admin";
import { logComplianceEvent } from "./soc2/events";

/** Default retention for inactive filed clients (years) — IRS often 3+; default 7 */
export function getRetentionYears(): number {
  const n = parseInt(process.env.DATA_RETENTION_YEARS || "7", 10);
  if (Number.isNaN(n) || n < 3) return 7;
  if (n > 30) return 30;
  return n;
}

/**
 * Soft-flag clients past retention for admin review (does not auto-delete PII
 * without explicit RETENTION_AUTO_PURGE=true — safer for tax firms).
 */
export async function runRetentionSweep(): Promise<{
  candidates: number;
  purged: number;
  details: string[];
}> {
  const years = getRetentionYears();
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffIso = cutoff.toISOString();

  const supabase = createAdminClient();
  const details: string[] = [];

  const { data: candidates, error } = await supabase
    .from("clients")
    .select("id, email, status, updated_at")
    .eq("status", "filed")
    .lt("updated_at", cutoffIso)
    .limit(500);

  if (error) {
    details.push(`query error: ${error.message}`);
    return { candidates: 0, purged: 0, details };
  }

  const list = candidates || [];
  details.push(`${list.length} filed clients older than ${years}y`);

  let purged = 0;
  if (process.env.RETENTION_AUTO_PURGE === "true") {
    for (const c of list) {
      // Anonymize rather than hard-delete audit trail integrity
      const { error: upErr } = await supabase
        .from("clients")
        .update({
          email: `purged+${c.id.slice(0, 8)}@invalid.local`,
          name: "REDACTED",
          phone: null,
          staff_notes: null,
          magic_token: null,
          magic_token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", c.id);
      if (!upErr) {
        purged += 1;
        await logComplianceEvent({
          eventType: "retention.purge",
          action: "anonymize",
          controlId: "C1.1",
          clientId: c.id,
          severity: "info",
          description: `Client PII anonymized after ${years}y retention`,
        });
      }
    }
  } else {
    for (const c of list.slice(0, 20)) {
      details.push(`candidate ${c.id} last updated ${c.updated_at}`);
    }
    await logComplianceEvent({
      eventType: "retention.sweep",
      action: "candidates_flagged",
      controlId: "C1.1",
      description: `${list.length} retention candidates (auto-purge off)`,
      metadata: { years, count: list.length },
    });
  }

  return { candidates: list.length, purged, details };
}
