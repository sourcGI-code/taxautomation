import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import { getClientById } from "@/lib/booking";
import { sendCustomMessage } from "@/lib/notifications";
import { assertSameOrigin } from "@/lib/security";

const notifySchema = z.object({
  clientId: z.string().uuid(),
  channel: z.enum(["email", "sms", "both"]),
  subject: z.string().max(200).optional(),
  message: z.string().min(1).max(5000),
});

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, channel, subject, message } = notifySchema.parse(body);

    const client = await getClientById(clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    await sendCustomMessage(client, message, channel, subject);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Notify error:", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
