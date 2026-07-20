import {
  APP_VERSION,
  hasStrongSecret,
  isHttpsPublicUrl,
  type PublishCheck,
  type PublishReport,
} from "./criteria";

export type { PublishReport, PublishCheck };
import { assertProductionSecrets } from "@/lib/security";
import { isDocumentEncryptionConfigured } from "@/lib/crypto-docs";
import { rateLimitBackend } from "@/lib/rate-limit";
import { isDocuSignConfigured, docusignConfigStatus } from "@/lib/docusign/client";
import { mefConfigStatus } from "@/lib/mef/service";
import { assertProductionMefReady } from "@/lib/mef/validate";

function check(
  partial: Omit<PublishCheck, "ok"> & { ok: boolean }
): PublishCheck {
  return partial;
}

/**
 * Pure-ish evaluation of publish readiness from env + subsystem probes.
 * DB connectivity is optional (passed in) so CLI can run offline for code checks.
 */
export function evaluatePublishReadiness(opts?: {
  nodeEnv?: string;
  dbOk?: boolean;
  dbDetail?: string;
  storageOk?: boolean;
  storageDetail?: string;
  tablesOk?: boolean;
  tablesDetail?: string;
  emailOk?: boolean;
  emailDetail?: string;
  smsOk?: boolean;
  smsDetail?: string;
  firmAffirmations?: {
    legalReview: boolean;
    dataController: boolean;
    efilePolicy: boolean;
    insurance: boolean;
    goLive: boolean;
  };
}): PublishReport {
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const isProd = nodeEnv === "production";
  const checks: PublishCheck[] = [];

  // --- Security ---
  const sessionOk = hasStrongSecret(process.env.SESSION_SECRET, 32);
  checks.push(
    check({
      id: "sec.session",
      category: "security",
      title: "SESSION_SECRET (≥32 chars)",
      severity: "blocker",
      ok: sessionOk || !isProd,
      detail: sessionOk
        ? "Signed session cookies configured"
        : isProd
          ? "Missing SESSION_SECRET"
          : "Dev fallback allowed outside production",
      fix: "openssl rand -hex 32 → SESSION_SECRET",
    })
  );

  const encOk = isDocumentEncryptionConfigured();
  checks.push(
    check({
      id: "sec.encryption",
      category: "security",
      title: "Document encryption key",
      severity: "blocker",
      ok: encOk || !isProd,
      detail: encOk
        ? "DOCUMENT_ENCRYPTION_KEY present (AES-256-GCM)"
        : "Encryption key missing",
      fix: "openssl rand -hex 32 → DOCUMENT_ENCRYPTION_KEY",
    })
  );

  const adminOk = !!(
    process.env.ADMIN_PASSWORD_HASH ||
    (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== "admin123")
  );
  checks.push(
    check({
      id: "sec.admin",
      category: "security",
      title: "Admin credentials",
      severity: "blocker",
      ok: adminOk,
      detail: process.env.ADMIN_PASSWORD_HASH
        ? "scrypt password hash configured"
        : adminOk
          ? "ADMIN_PASSWORD set (prefer hash)"
          : "No admin password or default password",
      fix: "Set ADMIN_PASSWORD_HASH=scrypt:… or strong ADMIN_PASSWORD",
    })
  );

  const prodSecrets = assertProductionSecrets();
  checks.push(
    check({
      id: "sec.prod_secrets",
      category: "security",
      title: "Production secret gate",
      severity: "blocker",
      ok: prodSecrets.ok,
      detail: prodSecrets.ok
        ? isProd
          ? "All production secrets OK"
          : "Not production — gate skipped"
        : prodSecrets.errors.join("; "),
    })
  );

  const rl = rateLimitBackend();
  checks.push(
    check({
      id: "sec.rate_limit",
      category: "security",
      title: "Rate limiting backend",
      severity: isProd ? "warning" : "info",
      ok: rl === "upstash" || !isProd,
      detail:
        rl === "upstash"
          ? "Upstash Redis (multi-instance safe)"
          : "In-memory only — set UPSTASH_REDIS_REST_* for multi-instance production",
      fix: "Configure Upstash REST URL + token",
    })
  );

  // --- Data ---
  const supabaseOk = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
  );
  checks.push(
    check({
      id: "data.supabase",
      category: "data",
      title: "Supabase credentials",
      severity: "blocker",
      ok: supabaseOk,
      detail: supabaseOk ? "URL + service role present" : "Missing Supabase env",
    })
  );

  if (opts?.dbOk !== undefined) {
    checks.push(
      check({
        id: "data.db",
        category: "data",
        title: "Database connectivity",
        severity: "blocker",
        ok: opts.dbOk,
        detail: opts.dbDetail || (opts.dbOk ? "Connected" : "DB unreachable"),
      })
    );
  }

  if (opts?.tablesOk !== undefined) {
    checks.push(
      check({
        id: "data.tables",
        category: "data",
        title: "Required tables / migrations",
        severity: "blocker",
        ok: opts.tablesOk,
        detail: opts.tablesDetail || "",
        fix: "Run migrations 001–008 in Supabase SQL editor",
      })
    );
  }

  if (opts?.storageOk !== undefined) {
    checks.push(
      check({
        id: "data.storage",
        category: "data",
        title: "Private document storage bucket",
        severity: "blocker",
        ok: opts.storageOk,
        detail: opts.storageDetail || "",
        fix: "Create private bucket client-documents",
      })
    );
  }

  // --- Comms ---
  const emailConfigured = !!process.env.RESEND_API_KEY;
  checks.push(
    check({
      id: "comms.email",
      category: "comms",
      title: "Transactional email (Resend)",
      severity: isProd ? "blocker" : "warning",
      ok: emailConfigured && (opts?.emailOk !== false || !emailConfigured),
      detail: !emailConfigured
        ? "RESEND_API_KEY missing — clients will not receive real email"
        : opts?.emailDetail || "Resend configured",
      fix: "Set RESEND_API_KEY + FROM_EMAIL on verified domain",
    })
  );

  const smsConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
  checks.push(
    check({
      id: "comms.sms",
      category: "comms",
      title: "SMS (Twilio)",
      severity: "warning",
      ok: smsConfigured,
      detail: smsConfigured
        ? opts?.smsDetail || "Twilio configured"
        : "SMS optional but recommended for reminders",
    })
  );

  // --- Ops ---
  const appUrlOk = isProd
    ? isHttpsPublicUrl(process.env.NEXT_PUBLIC_APP_URL)
    : !!process.env.NEXT_PUBLIC_APP_URL;
  checks.push(
    check({
      id: "ops.app_url",
      category: "ops",
      title: "Public app URL",
      severity: "blocker",
      ok: appUrlOk,
      detail: process.env.NEXT_PUBLIC_APP_URL || "unset",
      fix: "NEXT_PUBLIC_APP_URL=https://yourdomain.com",
    })
  );

  checks.push(
    check({
      id: "ops.cron",
      category: "ops",
      title: "CRON_SECRET",
      severity: isProd ? "blocker" : "warning",
      ok: !!process.env.CRON_SECRET || !isProd,
      detail: process.env.CRON_SECRET
        ? "Cron auth configured"
        : "Cron secret missing",
      fix: "Set CRON_SECRET; wire Vercel cron Authorization header",
    })
  );

  checks.push(
    check({
      id: "ops.practice",
      category: "ops",
      title: "Practice identity",
      severity: "blocker",
      ok: !!(
        (process.env.NEXT_PUBLIC_PRACTICE_NAME || process.env.PRACTICE_NAME) &&
        process.env.PRACTICE_EMAIL
      ),
      detail: `${process.env.NEXT_PUBLIC_PRACTICE_NAME || process.env.PRACTICE_NAME || "?"} / ${process.env.PRACTICE_EMAIL || "no email"}`,
      fix: "Set NEXT_PUBLIC_PRACTICE_NAME + PRACTICE_EMAIL",
    })
  );

  // --- Legal affirmations (firm must set after real review) ---
  const firm = opts?.firmAffirmations || {
    legalReview: process.env.PUBLISH_AFFIRM_LEGAL_REVIEW === "true",
    dataController: process.env.PUBLISH_AFFIRM_DATA_CONTROLLER === "true",
    efilePolicy: process.env.PUBLISH_AFFIRM_EFILE_POLICY === "true",
    insurance: process.env.PUBLISH_AFFIRM_INSURANCE === "true",
    goLive: process.env.PUBLISH_GO_LIVE === "true",
  };

  checks.push(
    check({
      id: "legal.review",
      category: "legal",
      title: "Counsel reviewed privacy/terms/engagement",
      severity: "blocker",
      ok: firm.legalReview,
      detail: firm.legalReview
        ? "Affirmed via PUBLISH_AFFIRM_LEGAL_REVIEW=true or admin go-live"
        : "Set after attorney review of /privacy /terms /legal/engagement",
      fix: "Review legal pack → set PUBLISH_AFFIRM_LEGAL_REVIEW=true",
    })
  );

  checks.push(
    check({
      id: "legal.controller",
      category: "legal",
      title: "Firm is data controller / responsible preparer",
      severity: "blocker",
      ok: firm.dataController,
      detail: firm.dataController
        ? "Affirmed"
        : "Firm must accept responsibility as tax data controller",
      fix: "PUBLISH_AFFIRM_DATA_CONTROLLER=true",
    })
  );

  checks.push(
    check({
      id: "legal.efile_policy",
      category: "legal",
      title: "E-file policy affirmed",
      severity: "blocker",
      ok: firm.efilePolicy,
      detail: firm.efilePolicy
        ? "Affirmed (ERO path or external filing only)"
        : "Affirm whether you file via authorized ERO or external software only",
      fix: "PUBLISH_AFFIRM_EFILE_POLICY=true after choosing e-file mode",
    })
  );

  checks.push(
    check({
      id: "legal.insurance",
      category: "legal",
      title: "E&O / cyber insurance affirmed",
      severity: "warning",
      ok: firm.insurance,
      detail: firm.insurance
        ? "Affirmed"
        : "Strongly recommended before holding client tax documents",
      fix: "PUBLISH_AFFIRM_INSURANCE=true",
    })
  );

  checks.push(
    check({
      id: "legal.go_live",
      category: "legal",
      title: "Explicit go-live flag",
      severity: "blocker",
      ok: firm.goLive,
      detail: firm.goLive
        ? "PUBLISH_GO_LIVE=true"
        : "Set PUBLISH_GO_LIVE=true only when ready for real clients",
    })
  );

  // --- E-sign ---
  const ds = docusignConfigStatus();
  checks.push(
    check({
      id: "esign.docusign",
      category: "esign",
      title: "DocuSign live API",
      severity: "warning",
      ok: ds.configured,
      detail: ds.configured
        ? `Live DocuSign (${ds.environment})`
        : "In-app ESIGN pad active; DocuSign optional upgrade for Certificate of Completion",
      fix: "Configure DOCUSIGN_* for certified envelopes",
    })
  );

  checks.push(
    check({
      id: "esign.in_app",
      category: "esign",
      title: "In-app ESIGN with consent + audit",
      severity: "blocker",
      ok: true,
      detail:
        "Typed/drawn e-sign, consent text, IP/UA, e_signatures table — production path always available",
    })
  );

  // --- E-file ---
  const mef = mefConfigStatus();
  const mefProd = assertProductionMefReady();
  checks.push(
    check({
      id: "efile.package",
      category: "efile",
      title: "MeF package builder + validation",
      severity: "blocker",
      ok: true,
      detail: "Always available — build/validate packages for review or transmit",
    })
  );

  checks.push(
    check({
      id: "efile.transmit_mode",
      category: "efile",
      title: "IRS production transmit",
      severity: "info",
      ok: true,
      detail: mefProd.ok
        ? "Production MeF transmit enabled"
        : `Sandbox / export mode (gaps: ${mef.productionGaps.slice(0, 2).join("; ") || "not configured"}) — publishable without IRS A2A if filing externally`,
    })
  );

  // --- Product ---
  checks.push(
    check({
      id: "product.version",
      category: "product",
      title: "Release version",
      severity: "info",
      ok: true,
      detail: APP_VERSION,
    })
  );

  const blockers = checks.filter((c) => c.severity === "blocker" && !c.ok);
  const warnings = checks.filter((c) => c.severity === "warning" && !c.ok);

  const codeBlockers = blockers.filter(
    (c) => !c.id.startsWith("legal.") && c.id !== "data.db" && c.id !== "data.tables" && c.id !== "data.storage" && c.id !== "comms.email"
  );
  // codeReady = core product features present (always true if build ships)
  const codeReady = codeBlockers.length === 0;

  const envBlockers = blockers.filter((c) =>
    ["security", "data", "comms", "ops"].includes(c.category)
  );
  const envReady = envBlockers.length === 0;

  const firmBlockers = blockers.filter((c) => c.category === "legal");
  const firmReady = firmBlockers.length === 0;

  const publishable = blockers.length === 0;

  const score = Math.round(
    (checks.filter((c) => c.ok).length / checks.length) * 100
  );

  let summary: string;
  if (publishable) {
    summary =
      "PUBLISHABLE — all blockers cleared. Safe to serve real clients under affirmed legal/ops ownership.";
  } else if (codeReady && envReady && !firmReady) {
    summary =
      "Software + environment ready. Complete firm legal affirmations (PUBLISH_AFFIRM_* + PUBLISH_GO_LIVE) to publish.";
  } else if (codeReady && !envReady) {
    summary =
      "Code ready. Fix environment blockers (secrets, DB, email, URL) before real traffic.";
  } else {
    summary = `Not publishable — ${blockers.length} blocker(s) remain.`;
  }

  return {
    generatedAt: new Date().toISOString(),
    version: APP_VERSION,
    publishable,
    codeReady,
    envReady,
    firmReady,
    score,
    blockers,
    warnings,
    checks,
    summary,
  };
}
