import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import { logCommunication, logActivity } from "@/lib/notifications";

const callLogSchema = z.object({
  clientId: z.string().uuid(),
  notes: z.string().min(1),
  outcome: z.enum(["answered", "voicemail", "no_answer", "callback_requested"]).optional(),
});

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, notes, outcome } = callLogSchema.parse(body);

    await logCommunication({
      clientId,
      channel: "call",
      body: notes,
      subject: outcome ? `Call - ${outcome}` : "Call logged",
    });

    await logActivity({
      clientId,
      action: "call_logged",
      description: notes,
      metadata: { outcome },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Call log error:", error);
    return NextResponse.json({ error: "Failed to log call" }, { status: 500 });
  }
}
