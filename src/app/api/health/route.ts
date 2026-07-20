import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { testResendConnection } from "@/lib/email";
import { testTwilioConnection } from "@/lib/sms";
import { assertProductionSecrets } from "@/lib/security";
import { rateLimitBackend } from "@/lib/rate-limit";
import { isDocumentEncryptionConfigured } from "@/lib/crypto-docs";
import { parseEnvStaffUsers } from "@/lib/staff";

export async function GET() {
  const checks: Record<string, { ok: boolean; message: string }> = {};

  // Required env vars
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];

  const hasServiceKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);

  const missing = required.filter((key) => !process.env[key]);
  checks.env = {
    ok: missing.length === 0 && hasServiceKey,
    message:
      missing.length === 0 && hasServiceKey
        ? "All required environment variables are set"
        : missing.length > 0
          ? `Missing: ${missing.join(", ")}`
          : "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY (server-side secret key)",
  };

  // Supabase connection
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("clients").select("id").limit(1);
    if (error?.code === "PGRST205") {
      checks.supabase = {
        ok: true,
        message: "Connected — run database migrations to create tables",
      };
    } else if (error) {
      throw error;
    } else {
      checks.supabase = { ok: true, message: "Connected. Clients table accessible." };
    }
  } catch (err) {
    checks.supabase = {
      ok: false,
      message: `Supabase error: ${err instanceof Error ? err.message : "connection failed"}`,
    };
  }

  // Check tables
  const tables = ["clients", "appointments", "intake_forms", "documents", "communications", "activity_log", "availability_rules", "notification_log"];
  try {
    const supabase = createAdminClient();
    const tableResults = await Promise.all(
      tables.map(async (table) => {
        const { error } = await supabase.from(table).select("id").limit(1);
        return { table, ok: !error, error: error?.message };
      })
    );
    const missingTables = tableResults.filter((t) => !t.ok);
    checks.tables = {
      ok: missingTables.length === 0,
      message:
        missingTables.length === 0
          ? `All ${tables.length} tables accessible`
          : `Missing tables: ${missingTables.map((t) => `${t.table} (${t.error})`).join(", ")}`,
    };
  } catch (err) {
    checks.tables = { ok: false, message: `Table check failed: ${err}` };
  }

  // Storage bucket
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from("client-documents").list("", { limit: 1 });
    checks.storage = {
      ok: !error,
      message: error
        ? `Storage bucket 'client-documents' not found. Create it in Supabase Dashboard → Storage.`
        : `Storage bucket 'client-documents' accessible`,
    };
  } catch (err) {
    checks.storage = { ok: false, message: `Storage check failed: ${err}` };
  }

  // Email (optional)
  const resendResult = await testResendConnection();
  checks.resend = {
    ok: true,
    message: resendResult.ok
      ? resendResult.message
      : `${resendResult.message} (optional — not required for local dev)`,
  };

  // SMS (optional)
  const twilioResult = await testTwilioConnection();
  checks.twilio = {
    ok: true,
    message: twilioResult.ok
      ? twilioResult.message
      : `${twilioResult.message} (optional — not required for local dev)`,
  };

  // Security posture
  const isProd = process.env.NODE_ENV === "production";
  const prodSecrets = assertProductionSecrets();
  checks.session_secret = {
    ok: !!(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) || !isProd,
    message:
      process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
        ? "SESSION_SECRET set (≥32 chars, signed v2 cookies)"
        : isProd
          ? "SESSION_SECRET missing or too short"
          : "SESSION_SECRET recommended (dev has fallback)",
  };
  checks.admin_auth = {
    ok: !!(process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD),
    message: process.env.ADMIN_PASSWORD_HASH
      ? "Admin password uses scrypt hash"
      : process.env.ADMIN_PASSWORD
        ? process.env.ADMIN_PASSWORD === "admin123"
          ? "ADMIN_PASSWORD is default admin123 — CHANGE IT"
          : "ADMIN_PASSWORD set (prefer ADMIN_PASSWORD_HASH)"
        : "No admin password configured",
  };
  if (process.env.ADMIN_PASSWORD === "admin123") {
    checks.admin_auth.ok = false;
  }
  checks.cron_secret = {
    ok: !!process.env.CRON_SECRET || !isProd,
    message: process.env.CRON_SECRET
      ? "CRON_SECRET is set"
      : isProd
        ? "CRON_SECRET missing — cron endpoint will reject in production"
        : "CRON_SECRET not set (ok for local; required in production)",
  };
  checks.magic_link_ttl = {
    ok: true,
    message: `Magic links expire in ${process.env.MAGIC_LINK_TTL_MINUTES || "60"} minutes (one-time use)`,
  };
  checks.document_encryption = {
    ok: !!process.env.DOCUMENT_ENCRYPTION_KEY?.trim() || !isProd,
    message: process.env.DOCUMENT_ENCRYPTION_KEY?.trim()
      ? "DOCUMENT_ENCRYPTION_KEY set — uploads encrypted at rest (AES-256-GCM)"
      : isProd
        ? "DOCUMENT_ENCRYPTION_KEY missing — required for production document security"
        : "DOCUMENT_ENCRYPTION_KEY not set (dev derives from SESSION_SECRET)",
  };
  checks.production_secrets = {
    ok: prodSecrets.ok,
    message: prodSecrets.ok
      ? isProd
        ? "Production secrets OK"
        : "Not production — prod secret gate skipped"
      : prodSecrets.errors.join("; "),
  };

  checks.rate_limit = {
    ok: true,
    message:
      rateLimitBackend() === "upstash"
        ? "Rate limit backend: Upstash Redis (multi-instance safe)"
        : "Rate limit backend: in-memory (set UPSTASH_REDIS_REST_* for multi-instance)",
  };

  checks.staff_accounts = {
    ok: true,
    message: `Owner auth configured; ${parseEnvStaffUsers().length} additional STAFF_USERS`,
  };

  checks.encryption_ready = {
    ok: isDocumentEncryptionConfigured() || !isProd,
    message: isDocumentEncryptionConfigured()
      ? "Document encryption key configured"
      : "Document encryption using dev fallback",
  };

  // Scaffold columns (003) + peak columns (006)
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("clients")
      .select(
        "tax_year, staff_notes, signature_acknowledged_at, assigned_preparer_name, signed_at"
      )
      .limit(1);
    checks.scaffold_schema = {
      ok: !error,
      message: error
        ? `Run migrations 003 + 006 — ${error.message}`
        : "Schema columns (tax_year, staff_notes, signature, preparer) present",
    };
  } catch (err) {
    checks.scaffold_schema = {
      ok: false,
      message: `Schema check failed: ${err}`,
    };
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("e_signatures").select("id").limit(1);
    checks.esign_table = {
      ok: !error,
      message: error
        ? `Run migration 006_peak_ops.sql for e_signatures — ${error.message}`
        : "e_signatures audit table accessible",
    };
  } catch (err) {
    checks.esign_table = {
      ok: false,
      message: `e_signatures check failed: ${err}`,
    };
  }

  const criticalChecks = [
    checks.env,
    checks.supabase,
    checks.tables,
    checks.storage,
    ...(isProd
      ? [checks.session_secret, checks.cron_secret, checks.document_encryption]
      : []),
  ];
  const criticalOk = criticalChecks.every((c) => c.ok);
  const allOk =
    criticalOk &&
    resendResult.ok &&
    twilioResult.ok &&
    checks.esign_table.ok;

  return NextResponse.json({
    status: allOk ? "ready" : criticalOk ? "partial" : "not_ready",
    version: "peak-1.0",
    checks,
    timestamp: new Date().toISOString(),
  });
}
