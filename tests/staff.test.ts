import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  canAssignPreparer,
  canChangeClientStatus,
  canExportAudit,
  canManageSettings,
  parseEnvStaffUsers,
  verifyEnvStaffLogin,
} from "@/lib/staff";
import {
  authenticateStaff,
  hashAdminPassword,
  verifyAdminPassword,
  __test_signAndVerify,
} from "@/lib/auth";

describe("staff permissions", () => {
  it("maps roles correctly", () => {
    expect(canChangeClientStatus("viewer")).toBe(false);
    expect(canChangeClientStatus("preparer")).toBe(true);
    expect(canAssignPreparer("owner")).toBe(true);
    expect(canAssignPreparer("preparer")).toBe(false);
    expect(canManageSettings("owner")).toBe(true);
    expect(canExportAudit("viewer")).toBe(false);
  });
});

describe("env staff users", () => {
  const prev = process.env.STAFF_USERS;

  afterEach(() => {
    if (prev === undefined) delete process.env.STAFF_USERS;
    else process.env.STAFF_USERS = prev;
  });

  it("parses STAFF_USERS", () => {
    process.env.STAFF_USERS = JSON.stringify([
      {
        email: "prep@firm.com",
        name: "Pat",
        password: "password123",
        role: "preparer",
      },
    ]);
    const users = parseEnvStaffUsers();
    expect(users).toHaveLength(1);
    expect(verifyEnvStaffLogin("prep@firm.com", "password123")?.role).toBe(
      "preparer"
    );
    expect(verifyEnvStaffLogin("prep@firm.com", "wrong")).toBe(null);
  });
});

describe("admin password + sessions", () => {
  const prevPass = process.env.ADMIN_PASSWORD;
  const prevHash = process.env.ADMIN_PASSWORD_HASH;
  const prevSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars!!";
    delete process.env.ADMIN_PASSWORD_HASH;
    process.env.ADMIN_PASSWORD = "super-secret-pass";
  });

  afterEach(() => {
    if (prevPass === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevPass;
    if (prevHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
    else process.env.ADMIN_PASSWORD_HASH = prevHash;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
  });

  it("verifies plain and scrypt passwords", () => {
    expect(verifyAdminPassword("super-secret-pass")).toBe(true);
    expect(verifyAdminPassword("nope")).toBe(false);

    const hash = hashAdminPassword("hashed-one");
    process.env.ADMIN_PASSWORD_HASH = hash;
    expect(verifyAdminPassword("hashed-one")).toBe(true);
    expect(verifyAdminPassword("super-secret-pass")).toBe(false);
  });

  it("authenticates owner via password-only", () => {
    const staff = authenticateStaff({ password: "super-secret-pass" });
    expect(staff?.role).toBe("owner");
  });

  it("signs and verifies tokens", () => {
    const json = JSON.stringify({ hello: "world" });
    expect(__test_signAndVerify(json)).toBe(json);
  });
});
