import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase/admin";
import { getSessionSecret } from "./security";
import {
  isStaffRole,
  verifyEnvStaffLogin,
  type StaffRole,
  type StaffSession,
} from "./staff";
import type { Client } from "./types";

const CLIENT_SESSION_COOKIE = "client_session";
const ADMIN_SESSION_COOKIE = "admin_session";

/** Client portal session: 24 hours */
const CLIENT_SESSION_MS = 60 * 60 * 24 * 1000;
/** Admin session: 8 hours */
const ADMIN_SESSION_MS = 60 * 60 * 8 * 1000;

type ClientPayload = { typ: "client"; sub: string; exp: number; v: 2 };
type AdminPayload = {
  typ: "admin";
  exp: number;
  v: 2;
  sid?: string;
  email?: string;
  name?: string;
  role?: StaffRole;
};

function b64url(data: string | Buffer): string {
  return Buffer.from(data).toString("base64url");
}

function signPayload(json: string): string {
  const payload = b64url(json);
  const sig = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function parseClientPayload(token: string): ClientPayload | null {
  const raw = verifyToken(token);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as ClientPayload;
    if (data.typ !== "client" || !data.sub || !data.exp || data.v !== 2) {
      return null;
    }
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function parseAdminPayload(token: string): AdminPayload | null {
  const raw = verifyToken(token);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as AdminPayload;
    if (data.typ !== "admin" || !data.exp || data.v !== 2) return null;
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export async function setClientSession(clientId: string) {
  const cookieStore = await cookies();
  const payload: ClientPayload = {
    typ: "client",
    sub: clientId,
    exp: Date.now() + CLIENT_SESSION_MS,
    v: 2,
  };
  const token = signPayload(JSON.stringify(payload));
  cookieStore.set(CLIENT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CLIENT_SESSION_MS / 1000,
    path: "/",
  });
}

export async function getClientSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(CLIENT_SESSION_COOKIE)?.value;
  if (!value) return null;

  // Signed v2 only — legacy raw UUIDs / unsigned cookies rejected
  const signed = parseClientPayload(value);
  return signed?.sub ?? null;
}

export async function clearClientSession() {
  const cookieStore = await cookies();
  cookieStore.delete(CLIENT_SESSION_COOKIE);
}

export async function getAuthenticatedClient(): Promise<Client | null> {
  const clientId = await getClientSession();
  if (!clientId) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  return data;
}

export async function setAdminSession(staff?: Partial<StaffSession>) {
  const cookieStore = await cookies();
  const payload: AdminPayload = {
    typ: "admin",
    exp: Date.now() + ADMIN_SESSION_MS,
    v: 2,
    sid: staff?.id || "owner",
    email: staff?.email || "owner@local",
    name: staff?.name || "Owner",
    role: staff?.role && isStaffRole(staff.role) ? staff.role : "owner",
  };
  const token = signPayload(JSON.stringify(payload));
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_SESSION_MS / 1000,
    path: "/",
  });
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const staff = await getAdminSession();
  return !!staff;
}

export async function getAdminSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!value) return null;
  const parsed = parseAdminPayload(value);
  if (!parsed) return null;
  return {
    id: parsed.sid || "owner",
    email: parsed.email || "owner@local",
    name: parsed.name || "Owner",
    role: isStaffRole(parsed.role) ? parsed.role : "owner",
  };
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

/**
 * Verify admin password.
 * Prefer ADMIN_PASSWORD_HASH=scrypt:salt:hex; fallback ADMIN_PASSWORD.
 * No default password — fail closed if neither is set.
 */
export function verifyAdminPassword(password: string): boolean {
  if (!password) return false;

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash?.startsWith("scrypt:")) {
    try {
      const parts = hash.split(":");
      if (parts.length !== 3) return false;
      const [, salt, stored] = parts;
      const derived = scryptSync(password, salt, 64).toString("hex");
      const a = Buffer.from(derived, "hex");
      const b = Buffer.from(stored, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Staff login:
 * 1) email+password against STAFF_USERS env
 * 2) password-only (or owner email) against ADMIN_PASSWORD / HASH → owner
 */
export function authenticateStaff(input: {
  email?: string;
  password: string;
}): StaffSession | null {
  const password = input.password;
  if (!password) return null;

  const email = input.email?.trim().toLowerCase();

  if (email) {
    const envStaff = verifyEnvStaffLogin(email, password);
    if (envStaff) return envStaff;

    // Owner can use any of: empty email, "owner", or ADMIN_EMAIL
    const ownerEmail = (
      process.env.ADMIN_EMAIL ||
      "owner@local"
    ).toLowerCase();
    if (
      (email === ownerEmail || email === "owner" || email === "admin") &&
      verifyAdminPassword(password)
    ) {
      return {
        id: "owner",
        email: ownerEmail,
        name: process.env.ADMIN_NAME || "Owner",
        role: "owner",
      };
    }
    return null;
  }

  // Password-only legacy path → owner
  if (verifyAdminPassword(password)) {
    return {
      id: "owner",
      email: (process.env.ADMIN_EMAIL || "owner@local").toLowerCase(),
      name: process.env.ADMIN_NAME || "Owner",
      role: "owner",
    };
  }

  return null;
}

/** Utility for generating ADMIN_PASSWORD_HASH offline */
export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

/** Exported for tests — sign/verify round-trip of payload JSON */
export function __test_signAndVerify(json: string): string | null {
  const token = signPayload(json);
  return verifyToken(token);
}
