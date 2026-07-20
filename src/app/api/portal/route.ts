import { NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const client = await getAuthenticatedClient();

    if (!client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data } = await supabase
      .from("clients")
      .select(
        `
        *,
        appointments(*),
        intake_forms(*),
        documents(*),
        activity_log(*)
      `
      )
      .eq("id", client.id)
      .single();

    // Never expose staff notes, storage paths, or encryption material to the portal
    if (data) {
      const { staff_notes: _staffNotes, ...rest } = data;
      const safeDocs = (rest.documents || []).map(
        (d: Record<string, unknown>) => ({
          id: d.id,
          client_id: d.client_id,
          name: d.name,
          file_size: d.file_size,
          mime_type: d.mime_type,
          category: d.category,
          uploaded_at: d.uploaded_at,
          encrypted: d.encrypted ?? false,
        })
      );
      return NextResponse.json({
        client: { ...rest, documents: safeDocs },
      });
    }

    return NextResponse.json({ client: data });
  } catch (error) {
    console.error("Portal data error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
