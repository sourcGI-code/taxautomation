import { NextRequest, NextResponse } from "next/server";
import {
  isAdminAuthenticated,
  authenticateStaff,
  setAdminSession,
  clearAdminSession,
  getAdminSession,
} from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security";
import { z } from "zod";

const loginSchema = z.object({
  password: z.string().min(1).max(200),
  email: z.string().email().max(254).optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const limited = await rateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        }
      );
    }

    const body = await request.json();
    const { password, email } = loginSchema.parse(body);

    const staff = authenticateStaff({
      email: email || undefined,
      password,
    });

    if (!staff) {
      await new Promise((r) =>
        setTimeout(r, 300 + Math.floor(Math.random() * 200))
      );
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await setAdminSession(staff);
    return NextResponse.json({
      success: true,
      staff: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
      },
    });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 400 });
  }
}

export async function GET() {
  const authenticated = await isAdminAuthenticated();
  const staff = authenticated ? await getAdminSession() : null;
  return NextResponse.json({
    authenticated,
    staff: staff
      ? {
          id: staff.id,
          email: staff.email,
          name: staff.name,
          role: staff.role,
        }
      : null,
  });
}

export async function DELETE(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await clearAdminSession();
  return NextResponse.json({ success: true });
}
