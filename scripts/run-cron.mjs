#!/usr/bin/env node
/**
 * Trigger reminder cron locally
 * Usage: node scripts/run-cron.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const cronSecret = process.env.CRON_SECRET || "";

console.log(`\n⏰ Running reminder cron at ${appUrl}/api/cron/reminders\n`);

try {
  const headers = cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {};
  const res = await fetch(`${appUrl}/api/cron/reminders`, { method: "POST", headers });
  const data = await res.json();

  if (!res.ok) {
    console.error("❌ Cron failed:", data.error);
    process.exit(1);
  }

  console.log(`✓ Processed: ${data.processed} reminder(s)`);
  for (const detail of data.details) {
    console.log(`  • ${detail}`);
  }
  console.log();
} catch (err) {
  console.error("❌ Could not reach dev server. Start with: npm run dev");
  console.error(`   ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
}
