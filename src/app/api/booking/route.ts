import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBooking } from "@/lib/booking";
import { onBookingCreated } from "@/lib/notifications";
import { setClientSession } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security";
import { recordBookingConsents } from "@/lib/consent";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPublicGoLiveEnabled, notLiveResponse } from "@/lib/publish/gate";

const bookingSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(254),
  phone: z.string().max(40).optional(),
  startsAt: z.string().min(10).max(40),
  endsAt: z.string().min(10).max(40),
  notes: z.string().max(2000).optional(),
  /** Required for publishable bookings — privacy, terms, electronic comms, ESIGN */
  acceptedLegal: z.literal(true),
});

export async function POST(request: NextRequest) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!(await isPublicGoLiveEnabled())) {
      return NextResponse.json(notLiveResponse(), { status: 503 });
    }

    const clientIp = getClientIp(request);
    const limited = await rateLimit(`booking:${clientIp}`, 8, 60 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many booking attempts. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        }
      );
    }

    const body = await request.json();

    // Honeypot: bots fill hidden "website" field
    if (body.website) {
      return NextResponse.json({ success: true, clientId: "ok" });
    }

    const data = bookingSchema.parse(body);

    const { client, appointment } = await createBooking({
      name: data.name,
      email: data.email,
      phone: data.phone,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      notes: data.notes,
    });

    await onBookingCreated(client, appointment.starts_at);
    await setClientSession(client.id);

    const ua = request.headers.get("user-agent") || undefined;
    await recordBookingConsents({
      clientId: client.id,
      ip: clientIp,
      userAgent: ua,
    });

    const now = new Date().toISOString();
    try {
      const supabase = createAdminClient();
      await supabase
        .from("clients")
        .update({
          privacy_accepted_at: now,
          updated_at: now,
        })
        .eq("id", client.id);
    } catch {
      /* consent rows may exist even if column update fails pre-migration */
    }

    return NextResponse.json({
      success: true,
      clientId: client.id,
      appointmentId: appointment.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Booking error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Booking failed" },
      { status: 500 }
    );
  }
}
