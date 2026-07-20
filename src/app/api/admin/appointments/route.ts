import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import { cancelAppointment, rescheduleAppointment } from "@/lib/booking";
import { logActivity } from "@/lib/notifications";
import { formatDateTime } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/security";

const cancelSchema = z.object({
  action: z.literal("cancel"),
  appointmentId: z.string().uuid(),
});

const rescheduleSchema = z.object({
  action: z.literal("reschedule"),
  appointmentId: z.string().uuid(),
  clientId: z.string().uuid(),
  startsAt: z.string(),
  endsAt: z.string(),
});

const bodySchema = z.discriminatedUnion("action", [cancelSchema, rescheduleSchema]);

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());

    if (body.action === "cancel") {
      const supabase = createAdminClient();
      const { data: existing } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", body.appointmentId)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      }

      const appt = await cancelAppointment(body.appointmentId);
      if (!appt) {
        return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
      }

      await logActivity({
        clientId: existing.client_id,
        action: "appointment_cancelled",
        description: `Staff cancelled appointment (${formatDateTime(existing.starts_at)})`,
        metadata: { appointment_id: existing.id, by: "staff" },
      });

      return NextResponse.json({ success: true, appointment: appt });
    }

    const appt = await rescheduleAppointment({
      appointmentId: body.appointmentId,
      clientId: body.clientId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
    });

    await logActivity({
      clientId: body.clientId,
      action: "appointment_rescheduled",
      description: `Staff rescheduled appointment to ${formatDateTime(appt.starts_at)}`,
      metadata: { appointment_id: appt.id, by: "staff" },
    });

    return NextResponse.json({ success: true, appointment: appt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Admin appointment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 }
    );
  }
}
