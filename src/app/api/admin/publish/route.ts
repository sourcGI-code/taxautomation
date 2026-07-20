import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { canManageSettings } from "@/lib/staff";
import { runLivePublishAssessment } from "@/lib/publish/runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/security";
import { logComplianceEvent } from "@/lib/soc2/events";
import { z } from "zod";

export async function GET() {
  const staff = await getAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runLivePublishAssessment();
  return NextResponse.json({ report });
}

const affirmSchema = z.object({
  affirm_legal_review: z.boolean().optional(),
  affirm_data_controller: z.boolean().optional(),
  affirm_efile_policy: z.boolean().optional(),
  affirm_insurance: z.boolean().optional(),
  go_live: z.boolean().optional(),
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
    const body = affirmSchema.parse(await request.json());
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const entries = Object.entries(body).filter(([, v]) => v !== undefined);
    for (const [key, value] of entries) {
      await supabase.from("firm_settings").upsert({
        key,
        value,
        updated_at: now,
        updated_by: staff.email,
      });
    }

    // If go_live requested true, re-check full report first
    if (body.go_live === true) {
      // Temporarily reflect new values by writing first then assessing
      const report = await runLivePublishAssessment();
      // go_live itself is now true in DB — but other blockers may remain
      const otherBlockers = report.blockers.filter(
        (b: { id: string }) => b.id !== "legal.go_live"
      );
      if (otherBlockers.length > 0) {
        await supabase.from("firm_settings").upsert({
          key: "go_live",
          value: false,
          updated_at: now,
          updated_by: staff.email,
        });
        return NextResponse.json(
          {
            error: "Cannot go live while blockers remain",
            blockers: otherBlockers,
          },
          { status: 400 }
        );
      }
    }

    await logComplianceEvent({
      eventType: "publish.affirmation",
      action: "update",
      controlId: "CC1.1",
      actorType: "staff",
      actorId: staff.id,
      actorEmail: staff.email,
      description: `Publish settings updated: ${entries.map(([k]) => k).join(", ")}`,
      metadata: Object.fromEntries(entries),
    });

    const report = await runLivePublishAssessment();
    return NextResponse.json({ success: true, report });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Publish settings error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
