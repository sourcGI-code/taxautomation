import { NextRequest, NextResponse } from "next/server";
import { processScheduledReminders } from "@/lib/notifications";

function authorizeCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");

  // Production requires secret
  if (process.env.NODE_ENV === "production") {
    if (!cronSecret) {
      console.error("[cron] CRON_SECRET is required in production");
      return false;
    }
    return authHeader === `Bearer ${cronSecret}`;
  }

  // Local: secret optional; if set, enforce it
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}` || vercelCron === "1";
  }

  return true;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processScheduledReminders();
    return NextResponse.json({
      success: true,
      processed: result.processed,
      details: result.details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron reminders error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
