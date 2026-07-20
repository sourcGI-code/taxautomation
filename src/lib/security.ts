import { NextRequest } from "next/server";

/** Magic link lifetime (minutes). Default 60. */
export function getMagicLinkTtlMinutes(): number {
  const raw = process.env.MAGIC_LINK_TTL_MINUTES;
  const n = raw ? parseInt(raw, 10) : 60;
  if (Number.isNaN(n) || n < 5) return 60;
  if (n > 24 * 60) return 24 * 60; // cap 24h
  return n;
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to a random string (≥32 chars) in production"
    );
  }

  // Dev-only fallback — never use in production
  return (
    process.env.ADMIN_PASSWORD_HASH ||
    process.env.ADMIN_PASSWORD ||
    "dev-only-insecure-session-secret-min-32-chars"
  );
}

export function assertProductionSecrets(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (process.env.NODE_ENV !== "production") {
    return { ok: true, errors: [] };
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    errors.push("SESSION_SECRET missing or too short (need ≥32 chars)");
  }
  if (!process.env.DOCUMENT_ENCRYPTION_KEY?.trim()) {
    errors.push(
      "DOCUMENT_ENCRYPTION_KEY required in production (openssl rand -hex 32)"
    );
  }
  if (!process.env.CRON_SECRET) {
    errors.push("CRON_SECRET required in production");
  }
  if (!process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD) {
    errors.push("ADMIN_PASSWORD_HASH or ADMIN_PASSWORD required");
  }
  if (process.env.ADMIN_PASSWORD === "admin123") {
    errors.push("ADMIN_PASSWORD must not be the default admin123");
  }
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SECRET_KEY
  ) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY required");
  }
  if (
    !process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
  ) {
    errors.push("NEXT_PUBLIC_APP_URL must be your public HTTPS domain in production");
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Reject cross-site state-changing requests (cookie CSRF mitigation).
 * Allows missing Origin for same-site navigations when Referer matches app.
 */
export function assertSameOrigin(request: NextRequest | Request): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let allowedHost: string;
  try {
    allowedHost = new URL(appUrl).host;
  } catch {
    allowedHost = "localhost:3000";
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === allowedHost;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === allowedHost;
    } catch {
      return false;
    }
  }

  // No Origin/Referer: allow only in development (API tools, scripts)
  return process.env.NODE_ENV !== "production";
}

export function securityHeaders(): Record<string, string> {
  const isDev = process.env.NODE_ENV === "development";

  // Pragmatic CSP for Next.js + Tailwind (inline styles) + Supabase storage signed URLs
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://*.docusign.com https://*.docusign.net https://account.docusign.com https://account-d.docusign.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "X-DNS-Prefetch-Control": "on",
    ...(isDev
      ? {}
      : {
          "Strict-Transport-Security":
            "max-age=63072000; includeSubDomains; preload",
        }),
  };
}
