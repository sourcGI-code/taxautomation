#!/usr/bin/env node
/**
 * Publish readiness self-diagnosis.
 * Exit 0 only when fully publishable (no blockers).
 * Use --code-only to skip live DB / firm affirmations for CI.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, ".env"));

const codeOnly = process.argv.includes("--code-only");
const forceProd = process.argv.includes("--production");

if (forceProd) process.env.NODE_ENV = "production";

// Dynamic import of compiled logic via duplicated evaluate for Node without TS —
// keep a self-contained evaluation here mirroring src/lib/publish/evaluate.ts

function isHttpsPublicUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname !== "localhost";
  } catch {
    return false;
  }
}

function hasStrong(v, min = 32) {
  return !!v && v.length >= min && v !== "admin123";
}

const isProd = process.env.NODE_ENV === "production";
const checks = [];

function add(id, title, severity, ok, detail, fix) {
  checks.push({ id, title, severity, ok, detail, fix });
}

add(
  "sec.session",
  "SESSION_SECRET",
  "blocker",
  hasStrong(process.env.SESSION_SECRET) || !isProd,
  hasStrong(process.env.SESSION_SECRET) ? "ok" : "missing/short",
  "openssl rand -hex 32"
);
add(
  "sec.encryption",
  "DOCUMENT_ENCRYPTION_KEY",
  "blocker",
  !!process.env.DOCUMENT_ENCRYPTION_KEY?.trim() || !isProd,
  process.env.DOCUMENT_ENCRYPTION_KEY ? "ok" : "missing",
  "openssl rand -hex 32"
);
add(
  "sec.admin",
  "Admin password",
  "blocker",
  !!(
    process.env.ADMIN_PASSWORD_HASH ||
    (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== "admin123")
  ),
  "configured",
  "Set strong ADMIN_PASSWORD or HASH"
);
add(
  "data.supabase",
  "Supabase",
  "blocker",
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
  ),
  "credentials",
  "Set URL + service role"
);
add(
  "ops.app_url",
  "APP URL",
  "blocker",
  isProd
    ? isHttpsPublicUrl(process.env.NEXT_PUBLIC_APP_URL)
    : !!process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_APP_URL || "unset",
  "https://yourdomain.com"
);
add(
  "ops.cron",
  "CRON_SECRET",
  isProd ? "blocker" : "warning",
  !!process.env.CRON_SECRET || !isProd,
  process.env.CRON_SECRET ? "ok" : "missing",
  "Set CRON_SECRET"
);
add(
  "ops.practice",
  "Practice name/email",
  "blocker",
  !!(
    (process.env.NEXT_PUBLIC_PRACTICE_NAME || process.env.PRACTICE_NAME) &&
    process.env.PRACTICE_EMAIL
  ),
  "identity",
  "Set PRACTICE_* env"
);
add(
  "comms.email",
  "Resend email",
  isProd ? "blocker" : "warning",
  !!process.env.RESEND_API_KEY || !isProd,
  process.env.RESEND_API_KEY ? "ok" : "missing",
  "RESEND_API_KEY"
);

// Product files exist
const requiredFiles = [
  "src/lib/mef/service.ts",
  "src/lib/docusign/service.ts",
  "src/lib/soc2/assessment.ts",
  "src/lib/crypto-docs.ts",
  "src/lib/auth.ts",
  "COMPLIANCE.md",
  "SECURITY.md",
  "supabase/migrations/008_publish_ready.sql",
];
for (const f of requiredFiles) {
  const ok = existsSync(resolve(root, f));
  add(`file.${f}`, f, "blocker", ok, ok ? "present" : "missing");
}

if (!codeOnly) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (url && key) {
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const tables = [
      "clients",
      "appointments",
      "documents",
      "e_signatures",
      "compliance_events",
      "mef_submissions",
      "docusign_envelopes",
      "firm_settings",
      "client_consents",
    ];
    let missing = [];
    for (const t of tables) {
      const { error } = await sb.from(t).select("*").limit(1);
      if (error) missing.push(`${t}: ${error.message}`);
    }
    add(
      "data.tables",
      "DB tables",
      "blocker",
      missing.length === 0,
      missing.length === 0 ? "all required tables OK" : missing.slice(0, 4).join("; "),
      "Run migrations including 008_publish_ready.sql"
    );

    const { error: storErr } = await sb.storage
      .from("client-documents")
      .list("", { limit: 1 });
    add(
      "data.storage",
      "Storage bucket",
      "blocker",
      !storErr,
      storErr ? storErr.message : "client-documents OK",
      "Create private bucket"
    );

    // firm affirmations from DB or env
    let firm = {
      legal: process.env.PUBLISH_AFFIRM_LEGAL_REVIEW === "true",
      controller: process.env.PUBLISH_AFFIRM_DATA_CONTROLLER === "true",
      efile: process.env.PUBLISH_AFFIRM_EFILE_POLICY === "true",
      go: process.env.PUBLISH_GO_LIVE === "true",
    };
    const { data: settings } = await sb
      .from("firm_settings")
      .select("key, value");
    if (settings) {
      const m = Object.fromEntries(settings.map((s) => [s.key, s.value]));
      const t = (v) => v === true || v === "true";
      firm.legal = firm.legal || t(m.affirm_legal_review);
      firm.controller = firm.controller || t(m.affirm_data_controller);
      firm.efile = firm.efile || t(m.affirm_efile_policy);
      firm.go = firm.go || t(m.go_live);
    }
    add("legal.review", "Legal review affirmed", "blocker", firm.legal, firm.legal ? "yes" : "no", "Admin Go-Live or PUBLISH_AFFIRM_LEGAL_REVIEW=true");
    add("legal.controller", "Data controller affirmed", "blocker", firm.controller, firm.controller ? "yes" : "no", "PUBLISH_AFFIRM_DATA_CONTROLLER=true");
    add("legal.efile", "E-file policy affirmed", "blocker", firm.efile, firm.efile ? "yes" : "no", "PUBLISH_AFFIRM_EFILE_POLICY=true");
    add("legal.go_live", "Go-live flag", "blocker", firm.go, firm.go ? "yes" : "no", "PUBLISH_GO_LIVE=true or admin");
  } else {
    add("data.live", "Live DB check", "blocker", false, "no credentials");
  }
}

const blockers = checks.filter((c) => c.severity === "blocker" && !c.ok);
const warnings = checks.filter((c) => c.severity === "warning" && !c.ok);
const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

console.log("\n=== Tax Portal Publish Check ===");
console.log(`Mode: ${codeOnly ? "code-only" : "full"} | NODE_ENV=${process.env.NODE_ENV || "undefined"}`);
console.log(`Score: ${score}% | Blockers: ${blockers.length} | Warnings: ${warnings.length}\n`);

for (const c of checks) {
  const mark = c.ok ? "✓" : c.severity === "blocker" ? "✗" : "!";
  console.log(`${mark} [${c.severity}] ${c.title}: ${c.detail}`);
  if (!c.ok && c.fix) console.log(`    fix: ${c.fix}`);
}

if (blockers.length === 0) {
  console.log("\n✓ PUBLISHABLE — no blockers.\n");
  process.exit(0);
}

console.log("\n✗ NOT PUBLISHABLE — resolve blockers above.\n");
process.exit(1);
