#!/usr/bin/env node
/**
 * Create storage bucket and policies via Supabase API
 * Usage: npm run db:storage
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("❌ Missing Supabase URL or secret key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

// Check if bucket exists
const { data: buckets } = await supabase.storage.listBuckets();
const exists = buckets?.some((b) => b.name === "client-documents");

if (exists) {
  console.log("✓ Storage bucket 'client-documents' already exists");
} else {
  const { data, error } = await supabase.storage.createBucket("client-documents", {
    public: false,
    fileSizeLimit: 10485760, // 10MB
  });
  if (error) {
    console.error("❌ Failed to create bucket:", error.message);
    process.exit(1);
  }
  console.log("✓ Created storage bucket 'client-documents'");
}

// Verify access
const { error: listError } = await supabase.storage.from("client-documents").list("", { limit: 1 });
if (listError) {
  console.error("⚠ Bucket exists but access failed:", listError.message);
  console.log("  You may need to add a storage policy in SQL Editor (see SETUP.md)");
} else {
  console.log("✓ Storage bucket is accessible");
}

console.log();
