#!/usr/bin/env node
/**
 * Apply publish-critical tables via Supabase if RPC not available —
 * attempts DATABASE_URL first, otherwise prints SQL path.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Probe which tables exist
const needed = [
  "firm_settings",
  "client_consents",
  "mef_submissions",
  "docusign_envelopes",
  "compliance_events",
  "e_signatures",
];

const missing = [];
for (const t of needed) {
  const { error } = await sb.from(t).select("*").limit(1);
  if (error) missing.push(t);
}

if (missing.length === 0) {
  console.log("✓ All publish tables present");
  // Ensure firm_settings seeds
  const seeds = [
    ["affirm_legal_review", false],
    ["affirm_data_controller", false],
    ["affirm_efile_policy", false],
    ["affirm_insurance", false],
    ["go_live", false],
  ];
  for (const [k, v] of seeds) {
    await sb.from("firm_settings").upsert({
      key: k,
      value: v,
      updated_by: "apply-publish-sql",
      updated_at: new Date().toISOString(),
    });
  }
  console.log("✓ firm_settings seeded");
  process.exit(0);
}

console.error(`
✗ Missing tables: ${missing.join(", ")}

Run in Supabase SQL Editor (required for publish):
  1) supabase/migrations/006_peak_ops.sql
  2) supabase/migrations/007_mef_docusign_soc2.sql
  3) supabase/migrations/008_publish_ready.sql

Or set DATABASE_URL and run: npm run db:migrate
`);
process.exit(1);
