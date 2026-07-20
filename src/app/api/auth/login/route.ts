import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMagicLink } from "@/lib/notifications";
import { getEmailConfig } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email().max(254),
});

export async function POST(request: NextRequest) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const limited = await rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        }
      );
    }

    const body = await request.json();
    const { email } = loginSchema.parse(body);

    const supabase = createAdminClient();
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (!client) {
      return NextResponse.json({
        success: true,
        message: "If an account exists, a link has been sent.",
      });
    }

    const { portalUrl } = await sendMagicLink(client);
    const emailConfig = getEmailConfig();

    return NextResponse.json({
      success: true,
      message: emailConfig.configured
        ? "If an account exists, a link has been sent."
        : "Email is in dev mode (no Resend key). Use the portal link below.",
      portalUrl: emailConfig.configured ? undefined : portalUrl,
      mode: emailConfig.mode,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    console.error("Login error:", error);
    return NextResponse.json({ error: "Failed to send login link" }, { status: 500 });
  }
}
