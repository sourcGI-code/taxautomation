/**
 * Definition of "publishable" for Tax Portal.
 *
 * A publishable release is a production-grade tax PRACTICE PORTAL that real
 * clients can use daily for booking, secure documents, portal workflow,
 * staff ops, e-sign, and optional MeF — with fail-closed production config
 * and honest feature activation (no false IRS/SOC2 claims).
 */

export type CheckSeverity = "blocker" | "warning" | "info";

export type PublishCheck = {
  id: string;
  category:
    | "security"
    | "data"
    | "comms"
    | "ops"
    | "legal"
    | "efile"
    | "esign"
    | "product";
  title: string;
  severity: CheckSeverity;
  ok: boolean;
  detail: string;
  fix?: string;
};

export type PublishReport = {
  generatedAt: string;
  version: string;
  publishable: boolean;
  /** Software/code quality ready for production deploy */
  codeReady: boolean;
  /** Environment secrets + integrations sufficient for real traffic */
  envReady: boolean;
  /** Firm affirmed legal/ops ownership (cannot be automated away) */
  firmReady: boolean;
  score: number;
  blockers: PublishCheck[];
  warnings: PublishCheck[];
  checks: PublishCheck[];
  summary: string;
};

export const APP_VERSION = "1.0.0";

export function isHttpsPublicUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return false;
    return true;
  } catch {
    return false;
  }
}

export function hasStrongSecret(value: string | undefined, min = 32): boolean {
  return !!value && value.length >= min && value !== "admin123";
}
