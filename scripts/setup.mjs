#!/usr/bin/env node
/**
 * Setup & health check script
 * Usage: node scripts/setup.mjs [--seed]
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load .env.local manually
function loadEnv() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return false;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
  return true;
}

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function printHeader() {
  console.log(colors.bold("\n🧾 Tax Portal — Setup & Health Check\n"));
}

async function checkHealth() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${appUrl}/api/health`);
    const data = await res.json();

    console.log(colors.bold("Health Check Results:\n"));

    for (const [key, check] of Object.entries(data.checks)) {
      const icon = check.ok ? colors.green("✓") : colors.red("✗");
      console.log(`  ${icon} ${key}: ${check.message}`);
    }

    console.log(`\n  Overall: ${data.status === "ready" ? colors.green("READY") : data.status === "partial" ? colors.yellow("PARTIAL") : colors.red("NOT READY")}`);
    return data;
  } catch {
    console.log(colors.yellow("\n  ⚠ Dev server not running. Start with: npm run dev"));
    console.log(colors.yellow("  Then run: npm run setup:check\n"));
    return null;
  }
}

async function seedTestData() {
  const { createClient } = await import("@supabase/supabase-js");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url.includes("placeholder")) {
    console.log(colors.red("\n  ✗ Cannot seed — configure Supabase in .env.local first\n"));
    return;
  }

  const supabase = createClient(url, key);

  const testEmail = "test@example.com";
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("email", testEmail)
    .maybeSingle();

  if (existing) {
    console.log(colors.yellow(`\n  ⚠ Test client already exists (${testEmail}). Skipping seed.\n`));
    return;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const end = new Date(tomorrow);
  end.setMinutes(30);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      email: testEmail,
      name: "Test Client",
      phone: "+15551234567",
      status: "booked",
      onboarding_step: "intake_pending",
    })
    .select()
    .single();

  if (clientError) {
    console.log(colors.red(`\n  ✗ Seed failed: ${clientError.message}\n`));
    return;
  }

  await supabase.from("appointments").insert({
    client_id: client.id,
    starts_at: tomorrow.toISOString(),
    ends_at: end.toISOString(),
    status: "scheduled",
  });

  await supabase.from("intake_forms").insert({
    client_id: client.id,
    data: {},
  });

  console.log(colors.green("\n  ✓ Test client seeded successfully!"));
  console.log(`    Email: ${testEmail}`);
  console.log(`    Appointment: ${tomorrow.toLocaleString()}`);
  console.log(`    Admin: http://localhost:3000/admin`);
  console.log(`    Book: http://localhost:3000/book\n`);
}

function printSetupInstructions() {
  console.log(colors.bold("Setup Steps:\n"));
  console.log("  1. Copy environment file:");
  console.log(colors.blue("     cp .env.example .env.local\n"));
  console.log("  2. Create a Supabase project at https://supabase.com\n");
  console.log("  3. Run migrations in Supabase SQL Editor:");
  console.log(colors.blue("     supabase/migrations/001_initial.sql"));
  console.log(colors.blue("     supabase/migrations/002_notification_log.sql\n"));
  console.log("  4. Create storage bucket 'client-documents' (private) in Supabase Dashboard\n");
  console.log("  5. Fill in .env.local with your Supabase keys\n");
  console.log("  6. (Optional) Add Resend + Twilio credentials for live email/SMS\n");
  console.log("  7. Start the dev server:");
  console.log(colors.blue("     npm run dev\n"));
  console.log("  8. Run health check:");
  console.log(colors.blue("     npm run setup:check\n"));
  console.log("  9. Test the full flow:");
  console.log("     • Book at /book");
  console.log("     • Check terminal for dev-mode emails/SMS");
  console.log("     • Login at /login with booking email");
  console.log("     • Complete intake + upload docs at /portal");
  console.log("     • Manage at /admin (password from ADMIN_PASSWORD)\n");
}

// Main
printHeader();

const hasEnv = loadEnv();
if (!hasEnv) {
  console.log(colors.yellow("  ⚠ .env.local not found\n"));
  printSetupInstructions();
  process.exit(1);
}

const shouldSeed = process.argv.includes("--seed");

if (shouldSeed) {
  await seedTestData();
} else {
  const health = await checkHealth();
  if (!health || health.status !== "ready") {
    printSetupInstructions();
  }
}
