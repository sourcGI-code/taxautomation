import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedClient } from "@/lib/auth";
import {
  cancelAppointment,
  rescheduleAppointment,
} from "@/lib/booking";
import { logActivity } from "@/lib/notifications";
import { formatDateTime } from "@/lib/utils";
import { assertSameOrigin } from "@/lib/security";

const cancelSchema = z.object({
  action: z.literal("cancel"),
  appointmentId: z.string().uuid(),
});

const rescheduleSchema = z.object({
  action: z.literal("reschedule"),
  appointmentId: z.string().uuid(),
  startsAt: z.string(),
  endsAt: z.string(),
});

const bodySchema = z.discriminatedUnion("action", [cancelSchema, rescheduleSchema]);

export async function POST(request: NextRequest) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await getAuthenticatedClient();
    if (!client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());

    if (body.action === "cancel") {
      const appt = await cancelAppointment(body.appointmentId, client.id);
      if (!appt) {
        return NextResponse.json(
          { error: "Appointment not found or already cancelled" },
          { status: 404 }
        );
      }

      await logActivity({
        clientId: client.id,
        action: "appointment_cancelled",
        description: `Appointment cancelled (${formatDateTime(appt.starts_at)})`,
        metadata: { appointment_id: appt.id },
      });

      return NextResponse.json({ success: true, appointment: appt });
    }

    const appt = await rescheduleAppointment({
      appointmentId: body.appointmentId,
      clientId: client.id,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
    });

    await logActivity({
      clientId: client.id,
      action: "appointment_rescheduled",
      description: `Appointment rescheduled to ${formatDateTime(appt.starts_at)}`,
      metadata: { appointment_id: appt.id, starts_at: appt.starts_at },
    });

    return NextResponse.json({ success: true, appointment: appt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Portal appointment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 }
    );
  }
}
