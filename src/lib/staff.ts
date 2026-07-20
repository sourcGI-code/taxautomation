/**
 * Multi-staff roles and permissions for the admin portal.
 */

export const STAFF_ROLES = ["owner", "preparer", "viewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffSession = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
};

export function isStaffRole(value: unknown): value is StaffRole {
  return (
    typeof value === "string" &&
    (STAFF_ROLES as readonly string[]).includes(value)
  );
}

export function canChangeClientStatus(role: StaffRole): boolean {
  return role === "owner" || role === "preparer";
}

export function canEditStaffNotes(role: StaffRole): boolean {
  return role === "owner" || role === "preparer";
}

export function canNotifyClients(role: StaffRole): boolean {
  return role === "owner" || role === "preparer";
}

export function canManageSettings(role: StaffRole): boolean {
  return role === "owner";
}

export function canAssignPreparer(role: StaffRole): boolean {
  return role === "owner";
}

export function canExportAudit(role: StaffRole): boolean {
  return role === "owner" || role === "preparer";
}

export function canDownloadDocuments(role: StaffRole): boolean {
  return role === "owner" || role === "preparer" || role === "viewer";
}

export function canManageStaff(role: StaffRole): boolean {
  return role === "owner";
}

export type EnvStaffUser = {
  email: string;
  name: string;
  password: string;
  role: StaffRole;
};

/**
 * Optional multi-staff via env (no DB required):
 * STAFF_USERS=[{"email":"a@firm.com","name":"Alex","password":"…","role":"preparer"}]
 */
export function parseEnvStaffUsers(): EnvStaffUser[] {
  const raw = process.env.STAFF_USERS?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const r = row as Record<string, unknown>;
        const email = String(r.email || "")
          .trim()
          .toLowerCase();
        const name = String(r.name || "").trim();
        const password = String(r.password || "");
        const role = isStaffRole(r.role) ? r.role : "preparer";
        if (!email || !password || password.length < 8) return null;
        return {
          email,
          name: name || email.split("@")[0] || "Staff",
          password,
          role,
        };
      })
      .filter((x): x is EnvStaffUser => !!x);
  } catch {
    return [];
  }
}

export function verifyEnvStaffLogin(
  email: string,
  password: string
): StaffSession | null {
  const users = parseEnvStaffUsers();
  const normalized = email.trim().toLowerCase();
  const match = users.find((u) => u.email === normalized);
  if (!match) return null;
  if (match.password !== password) return null;
  return {
    id: `env:${match.email}`,
    email: match.email,
    name: match.name,
    role: match.role,
  };
}
