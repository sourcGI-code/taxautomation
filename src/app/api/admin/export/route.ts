import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { canExportAudit } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/security";

/**
 * CSV audit export for compliance / WISP-style record keeping.
 * GET /api/admin/export?type=clients|activity|signatures|communications
 */
export async function GET(request: NextRequest) {
  if (!assertSameOrigin(request) && process.env.NODE_ENV === "production") {
    // GET exports may be navigated — allow same session without Origin on GET
  }

  const staff = await getAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canExportAudit(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const type = request.nextUrl.searchParams.get("type") || "clients";
  const supabase = createAdminClient();

  try {
    let rows: Record<string, unknown>[] = [];
    let filename = "export.csv";

    if (type === "clients") {
      const { data, error } = await supabase
        .from("clients")
        .select(
          "id,email,name,phone,status,onboarding_step,tax_year,assigned_preparer_name,signed_at,signature_typed_name,created_at,updated_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      rows = data || [];
      filename = `clients-${dateStamp()}.csv`;
    } else if (type === "activity") {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id,client_id,action,description,created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      rows = data || [];
      filename = `activity-${dateStamp()}.csv`;
    } else if (type === "signatures") {
      const { data, error } = await supabase
        .from("e_signatures")
        .select(
          "id,client_id,typed_name,method,ip,signed_at,created_at"
        )
        .order("signed_at", { ascending: false })
        .limit(2000);
      if (error) {
        // Fallback if migration not applied
        const { data: clients } = await supabase
          .from("clients")
          .select(
            "id,email,name,signed_at,signature_typed_name,signature_method,signature_ip"
          )
          .not("signed_at", "is", null);
        rows = clients || [];
      } else {
        rows = data || [];
      }
      filename = `signatures-${dateStamp()}.csv`;
    } else if (type === "communications") {
      const { data, error } = await supabase
        .from("communications")
        .select("id,client_id,channel,direction,subject,status,created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      rows = data || [];
      filename = `communications-${dateStamp()}.csv`;
    } else {
      return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
    }

    const csv = toCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "empty\n";
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [keys.join(",")];
  for (const row of rows) {
    lines.push(keys.map((k) => escape(row[k])).join(","));
  }
  return lines.join("\n") + "\n";
}
