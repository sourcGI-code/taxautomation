import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/booking";
import { setClientSession } from "@/lib/auth";
import { consumeMagicToken, logActivity } from "@/lib/notifications";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit(`verify:${ip}`, 20, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.redirect(
        new URL("/login?error=rate_limited", request.url)
      );
    }

    const token = request.nextUrl.searchParams.get("token");

    if (!token || token.length < 20 || token.length > 200) {
      return NextResponse.redirect(new URL("/login?error=invalid", request.url));
    }

    // Basic UUID format check (reject injection junk early)
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        token
      )
    ) {
      return NextResponse.redirect(new URL("/login?error=invalid", request.url));
    }

    const client = await getClientByToken(token);

    if (!client) {
      return NextResponse.redirect(new URL("/login?error=expired", request.url));
    }

    // One-time link: burn token before session so replay fails
    await consumeMagicToken(client.id);
    await setClientSession(client.id);

    await logActivity({
      clientId: client.id,
      action: "magic_link_used",
      description: "Client logged in via magic link (token consumed)",
    });

    return NextResponse.redirect(new URL("/portal", request.url));
  } catch (error) {
    console.error("Auth verify error:", error);
    return NextResponse.redirect(new URL("/login?error=failed", request.url));
  }
}
