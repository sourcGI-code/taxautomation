import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { onBookingCreated } from "@/lib/notifications";
import { verifyCalWebhookSignature } from "@/lib/webhooks";
import { getDefaultTaxYear } from "@/lib/tax-year";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit(`cal-webhook:${ip}`, 60, 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const rawBody = await request.text();
    const signature =
      request.headers.get("x-cal-signature-256") ||
      request.headers.get("x-cal-signature");

    if (!verifyCalWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const triggerEvent = body.triggerEvent;

    if (triggerEvent !== "BOOKING_CREATED") {
      return NextResponse.json({ received: true });
    }

    const { name, email, phone, startTime, endTime } = body.payload || {};

    if (!email || !startTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();

    let { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (!client) {
      const { data: created } = await supabase
        .from("clients")
        .insert({
          email: email.toLowerCase(),
          name: name || email,
          phone: phone || null,
          status: "booked",
          onboarding_step: "welcome_sent",
          tax_year: getDefaultTaxYear(),
        })
        .select()
        .single();
      client = created;
    }

    if (!client) {
      return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
    }

    const { data: appointment } = await supabase
      .from("appointments")
      .insert({
        client_id: client.id,
        starts_at: startTime,
        ends_at: endTime || startTime,
        cal_event_id: body.payload?.uid,
        status: "scheduled",
      })
      .select()
      .single();

    if (appointment) {
      await onBookingCreated(client, appointment.starts_at);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cal.com webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
