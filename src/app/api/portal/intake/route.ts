import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedClient } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { onIntakeSubmitted } from "@/lib/notifications";
import { assertSameOrigin } from "@/lib/security";

const intakeSchema = z.object({
  filing_status: z.string().max(80).optional(),
  dependents: z.coerce.number().min(0).max(30).optional(),
  has_w2: z.boolean().optional(),
  has_1099: z.boolean().optional(),
  has_investments: z.boolean().optional(),
  has_rental_income: z.boolean().optional(),
  has_business_income: z.boolean().optional(),
  prior_year_filed: z.boolean().optional(),
  additional_notes: z.string().max(5000).optional(),
  ssn_last_four: z
    .string()
    .regex(/^\d{0,4}$/, "SSN last four must be digits only")
    .max(4)
    .optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(2).optional(),
  zip: z.string().max(12).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await getAuthenticatedClient();
    if (!client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = intakeSchema.parse(body);

    const supabase = createAdminClient();
    const { error } = await supabase.from("intake_forms").upsert(
      {
        client_id: client.id,
        data,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "client_id" }
    );

    if (error) throw error;

    await onIntakeSubmitted(client);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Intake error:", error);
    return NextResponse.json({ error: "Failed to submit intake" }, { status: 500 });
  }
}
