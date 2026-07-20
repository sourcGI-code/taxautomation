import { NextRequest, NextResponse } from "next/server";
import { processScheduledReminders } from "@/lib/notifications";
import { runRetentionSweep } from "@/lib/retention";
import { logComplianceEvent } from "@/lib/soc2/events";

function authorizeCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");

  if (process.env.NODE_ENV === "production") {
    if (!cronSecret) return false;
    return authHeader === `Bearer ${cronSecret}`;
  }
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}` || vercelCron === "1";
  }
  return true;
}

/** Combined maintenance: reminders + retention sweep */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [reminders, retention] = await Promise.all([
      processScheduledReminders(),
      runRetentionSweep(),
    ]);

    await logComplianceEvent({
      eventType: "ops.maintenance",
      action: "cron",
      controlId: "A1.1",
      description: `Maintenance: ${reminders.processed} reminders, ${retention.candidates} retention candidates`,
      metadata: {
        reminders: reminders.processed,
        retention_candidates: retention.candidates,
        purged: retention.purged,
      },
    });

    return NextResponse.json({
      success: true,
      reminders,
      retention,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Maintenance cron error:", error);
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
}
