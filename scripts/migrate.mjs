#!/usr/bin/env node
/**
 * Run database migrations against Supabase Postgres
 * Requires DATABASE_URL in .env.local
 *
 * Usage: npm run db:migrate
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  console.error(`
❌ DATABASE_URL not set.

Get it from Supabase Dashboard:
  Settings → Database → Connection string → URI

Or run migrations manually in SQL Editor (in order):
  001_initial.sql … 008_publish_ready.sql
  (or 000_all.sql then 006–008 for upgrades)
`);
  process.exit(1);
}

const migrationsDir = join(root, "supabase/migrations");
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && f !== "000_all.sql")
  .sort();

const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

try {
  for (const file of migrations) {
    const path = join(migrationsDir, file);
    console.log(`Running ${file}...`);
    const content = readFileSync(path, "utf-8");
    await sql.unsafe(content);
    console.log(`  ✓ Done`);
  }
  console.log("\n✓ All migrations applied successfully.\n");
} catch (err) {
  console.error("\n❌ Migration failed:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
