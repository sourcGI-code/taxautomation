import { evaluatePublishReadiness } from "./evaluate";
import type { PublishReport } from "./criteria";
import { createAdminClient } from "@/lib/supabase/admin";
import { testResendConnection } from "@/lib/email";
import { testTwilioConnection } from "@/lib/sms";

const REQUIRED_TABLES = [
  "clients",
  "appointments",
  "intake_forms",
  "documents",
  "communications",
  "activity_log",
  "availability_rules",
  "notification_log",
  "e_signatures",
  "compliance_events",
  "mef_submissions",
  "docusign_envelopes",
  "firm_settings",
  "client_consents",
] as const;

export async function loadFirmAffirmations(): Promise<{
  legalReview: boolean;
  dataController: boolean;
  efilePolicy: boolean;
  insurance: boolean;
  goLive: boolean;
}> {
  // Env always wins as override
  const fromEnv = {
    legalReview: process.env.PUBLISH_AFFIRM_LEGAL_REVIEW === "true",
    dataController: process.env.PUBLISH_AFFIRM_DATA_CONTROLLER === "true",
    efilePolicy: process.env.PUBLISH_AFFIRM_EFILE_POLICY === "true",
    insurance: process.env.PUBLISH_AFFIRM_INSURANCE === "true",
    goLive: process.env.PUBLISH_GO_LIVE === "true",
  };

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("firm_settings")
      .select("key, value")
      .in("key", [
        "affirm_legal_review",
        "affirm_data_controller",
        "affirm_efile_policy",
        "affirm_insurance",
        "go_live",
      ]);

    const map = new Map((data || []).map((r) => [r.key, r.value]));
    const truthy = (v: unknown) => v === true || v === "true" || v === "1";

    return {
      legalReview: fromEnv.legalReview || truthy(map.get("affirm_legal_review")),
      dataController:
        fromEnv.dataController || truthy(map.get("affirm_data_controller")),
      efilePolicy: fromEnv.efilePolicy || truthy(map.get("affirm_efile_policy")),
      insurance: fromEnv.insurance || truthy(map.get("affirm_insurance")),
      goLive: fromEnv.goLive || truthy(map.get("go_live")),
    };
  } catch {
    return fromEnv;
  }
}

export async function runLivePublishAssessment(): Promise<PublishReport> {
  let dbOk = false;
  let dbDetail = "Not checked";
  let tablesOk = false;
  let tablesDetail = "";
  let storageOk = false;
  let storageDetail = "";

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("clients").select("id").limit(1);
    if (error) {
      dbOk = false;
      dbDetail = error.message;
    } else {
      dbOk = true;
      dbDetail = "Connected";
    }

    const missing: string[] = [];
    for (const table of REQUIRED_TABLES) {
      const { error: tErr } = await supabase.from(table).select("*").limit(1);
      if (tErr) missing.push(`${table}: ${tErr.message}`);
    }
    tablesOk = missing.length === 0;
    tablesDetail = tablesOk
      ? `All ${REQUIRED_TABLES.length} required tables OK`
      : `Missing/broken: ${missing.slice(0, 5).join("; ")}`;

    const { error: sErr } = await supabase.storage
      .from("client-documents")
      .list("", { limit: 1 });
    storageOk = !sErr;
    storageDetail = sErr
      ? sErr.message
      : "Bucket client-documents accessible";
  } catch (err) {
    dbOk = false;
    dbDetail = err instanceof Error ? err.message : "DB failed";
    tablesDetail = dbDetail;
    storageDetail = dbDetail;
  }

  const email = await testResendConnection();
  const sms = await testTwilioConnection();
  const firmAffirmations = await loadFirmAffirmations();

  return evaluatePublishReadiness({
    dbOk,
    dbDetail,
    tablesOk,
    tablesDetail,
    storageOk,
    storageDetail,
    emailOk: email.ok || !process.env.RESEND_API_KEY,
    emailDetail: email.message,
    smsOk: sms.ok,
    smsDetail: sms.message,
    firmAffirmations,
  });
}
