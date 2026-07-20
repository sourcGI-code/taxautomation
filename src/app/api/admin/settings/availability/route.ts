import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  listAvailabilityRules,
  upsertAvailabilityRule,
  deleteAvailabilityRule,
} from "@/lib/booking";
import { assertSameOrigin } from "@/lib/security";

const ruleSchema = z.object({
  id: z.string().uuid().optional(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().min(4),
  end_time: z.string().min(4),
  slot_duration_minutes: z.number().int().min(15).max(240).default(30),
  is_active: z.boolean().default(true),
});

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await listAvailabilityRules();
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = ruleSchema.parse(await request.json());
    const rule = await upsertAvailabilityRule(body);
    return NextResponse.json({ rule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Availability save error:", error);
    return NextResponse.json({ error: "Failed to save rule" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    await deleteAvailabilityRule(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Availability delete error:", error);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}
