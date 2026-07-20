import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { canChangeClientStatus } from "@/lib/staff";
import { assertSameOrigin } from "@/lib/security";
import {
  createMefDraft,
  listMefForClient,
  mefConfigStatus,
  transmitMefSubmission,
} from "@/lib/mef/service";
import { MEF_FORM_TYPES } from "@/lib/mef/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultTaxYear } from "@/lib/tax-year";

const createSchema = z.object({
  clientId: z.string().uuid(),
  forceSandbox: z.boolean().optional(),
  payload: z
    .object({
      taxYear: z.number().int().optional(),
      formType: z.enum(MEF_FORM_TYPES).optional(),
      taxpayer: z
        .object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          ssnLastFour: z.string().optional(),
          ssnFull: z.string().optional(),
          filingStatus: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          address: z
            .object({
              street: z.string().optional(),
              city: z.string().optional(),
              state: z.string().optional(),
              zip: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      spouse: z
        .object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          ssnLastFour: z.string().optional(),
        })
        .optional(),
      income: z
        .object({
          wages: z.number().optional(),
          interest: z.number().optional(),
          dividends: z.number().optional(),
          businessIncome: z.number().optional(),
          capitalGains: z.number().optional(),
          otherIncome: z.number().optional(),
        })
        .optional(),
      deductions: z
        .object({
          standardOrItemized: z.enum(["standard", "itemized"]).optional(),
          amount: z.number().optional(),
        })
        .optional(),
      tax: z
        .object({
          totalTax: z.number().optional(),
          withholdings: z.number().optional(),
          estimatedPayments: z.number().optional(),
          refundOrOwe: z.number().optional(),
        })
        .optional(),
      bank: z
        .object({
          routingNumber: z.string().optional(),
          accountNumberLast4: z.string().optional(),
          accountType: z.enum(["checking", "savings"]).optional(),
        })
        .optional(),
      preparer: z
        .object({
          name: z.string().optional(),
          ptin: z.string().optional(),
          efin: z.string().optional(),
          firmName: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const transmitSchema = z.object({
  submissionId: z.string().uuid(),
  forceSandbox: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const staff = await getAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get("clientId");
  const config = mefConfigStatus();

  if (!clientId) {
    return NextResponse.json({ config });
  }

  const submissions = await listMefForClient(clientId);
  return NextResponse.json({ config, submissions });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const staff = await getAdminSession();
  if (!staff || !canChangeClientStatus(staff.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "create") {
      const data = createSchema.parse(body);
      const supabase = createAdminClient();
      const { data: client } = await supabase
        .from("clients")
        .select("*, intake_forms(*)")
        .eq("id", data.clientId)
        .single();

      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }

      const intake = (client.intake_forms as { data?: Record<string, unknown> }[])?.[0]
        ?.data as Record<string, unknown> | undefined;

      const nameParts = String(client.name || "").trim().split(/\s+/);
      const firstName =
        data.payload?.taxpayer?.firstName || nameParts[0] || "Taxpayer";
      const lastName =
        data.payload?.taxpayer?.lastName ||
        nameParts.slice(1).join(" ") ||
        "Client";

      const payload = {
        taxYear: data.payload?.taxYear || client.tax_year || getDefaultTaxYear(),
        formType: data.payload?.formType || ("1040" as const),
        taxpayer: {
          firstName,
          lastName,
          ssnLastFour:
            data.payload?.taxpayer?.ssnLastFour ||
            (intake?.ssn_last_four as string | undefined),
          ssnFull: data.payload?.taxpayer?.ssnFull,
          filingStatus:
            data.payload?.taxpayer?.filingStatus ||
            (intake?.filing_status as string) ||
            "Single",
          email: data.payload?.taxpayer?.email || client.email,
          phone: data.payload?.taxpayer?.phone || client.phone || undefined,
          address: {
            street:
              data.payload?.taxpayer?.address?.street ||
              (intake?.address as string) ||
              "Address required",
            city:
              data.payload?.taxpayer?.address?.city ||
              (intake?.city as string) ||
              "City",
            state:
              data.payload?.taxpayer?.address?.state ||
              (intake?.state as string) ||
              "IN",
            zip:
              data.payload?.taxpayer?.address?.zip ||
              (intake?.zip as string) ||
              "00000",
          },
        },
        spouse:
          data.payload?.spouse?.firstName && data.payload?.spouse?.lastName
            ? {
                firstName: data.payload.spouse.firstName,
                lastName: data.payload.spouse.lastName,
                ssnLastFour: data.payload.spouse.ssnLastFour,
              }
            : undefined,
        income: {
          wages: data.payload?.income?.wages ?? 0,
          interest: data.payload?.income?.interest ?? 0,
          dividends: data.payload?.income?.dividends ?? 0,
          businessIncome: data.payload?.income?.businessIncome ?? 0,
          capitalGains: data.payload?.income?.capitalGains ?? 0,
          otherIncome: data.payload?.income?.otherIncome ?? 0,
        },
        deductions: {
          standardOrItemized:
            data.payload?.deductions?.standardOrItemized || "standard",
          amount: data.payload?.deductions?.amount ?? 14600,
        },
        tax: {
          totalTax: data.payload?.tax?.totalTax ?? 0,
          withholdings: data.payload?.tax?.withholdings ?? 0,
          estimatedPayments: data.payload?.tax?.estimatedPayments ?? 0,
          refundOrOwe: data.payload?.tax?.refundOrOwe ?? 0,
        },
        bank: data.payload?.bank,
        preparer: {
          name: data.payload?.preparer?.name || staff.name,
          ptin: data.payload?.preparer?.ptin || process.env.IRS_PTIN,
          efin: data.payload?.preparer?.efin || process.env.IRS_EFIN,
          firmName:
            data.payload?.preparer?.firmName ||
            process.env.IRS_ERO_LEGAL_NAME ||
            process.env.NEXT_PUBLIC_PRACTICE_NAME,
        },
      };

      const row = await createMefDraft({
        clientId: data.clientId,
        payload,
        preparedBy: staff.name,
      });

      return NextResponse.json({ success: true, submission: row, config: mefConfigStatus() });
    }

    if (action === "transmit") {
      const data = transmitSchema.parse(body);
      const row = await transmitMefSubmission({
        submissionRowId: data.submissionId,
        staffName: staff.name,
        forceSandbox: data.forceSandbox,
      });
      return NextResponse.json({ success: true, submission: row, config: mefConfigStatus() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("MeF API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "MeF failed" },
      { status: 500 }
    );
  }
}
