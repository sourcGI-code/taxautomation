import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { securityHeaders } from "@/lib/security";

/**
 * Next.js 16 Proxy (formerly middleware): security headers on all responses.
 * Auth remains server-side in route handlers — do not trust proxy alone.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const headers = securityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  // Helpful for debugging (non-sensitive)
  response.headers.set("X-Tax-Portal-Security", "v2");

  // Block common scanner paths early (optional noise reduction)
  const path = request.nextUrl.pathname.toLowerCase();
  if (
    path.includes("wp-admin") ||
    path.includes("wp-login") ||
    path.endsWith(".php") ||
    path.includes("/.env")
  ) {
    return new NextResponse(null, { status: 404, headers });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
