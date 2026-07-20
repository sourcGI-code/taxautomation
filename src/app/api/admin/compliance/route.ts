import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { canExportAudit, canManageSettings } from "@/lib/staff";
import { runSoc2Assessment } from "@/lib/soc2/assessment";
import { SOC2_CONTROLS } from "@/lib/soc2/controls";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/security";
import { logComplianceEvent, recordControlEvidence } from "@/lib/soc2/events";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const staff = await getAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canExportAudit(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mode = request.nextUrl.searchParams.get("mode") || "report";

  if (mode === "catalog") {
    return NextResponse.json({ controls: SOC2_CONTROLS });
  }

  if (mode === "events") {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("compliance_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      return NextResponse.json({
        events: [],
        warning: error.message,
      });
    }
    return NextResponse.json({ events: data || [] });
  }

  const report = await runSoc2Assessment();
  return NextResponse.json({ report });
}

const evidenceSchema = z.object({
  controlId: z.string().min(2).max(20),
  evidenceType: z.string().min(2).max(80),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["collected", "reviewed", "gap", "remediated"]).optional(),
});

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const staff = await getAdminSession();
  if (!staff || !canManageSettings(staff.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (body.action === "add_evidence") {
      const data = evidenceSchema.parse(body);
      await recordControlEvidence({
        controlId: data.controlId,
        evidenceType: data.evidenceType,
        title: data.title,
        description: data.description,
        status: data.status,
        metadata: { added_by: staff.email },
      });
      await logComplianceEvent({
        eventType: "soc2.evidence",
        action: "added",
        controlId: data.controlId,
        actorType: "staff",
        actorId: staff.id,
        actorEmail: staff.email,
        description: `Evidence: ${data.title}`,
      });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
