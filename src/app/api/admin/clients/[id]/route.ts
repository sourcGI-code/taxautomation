import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { getClientById } from "@/lib/booking";
import { createAdminClient } from "@/lib/supabase/admin";
import { onStatusChanged, logActivity } from "@/lib/notifications";
import { CLIENT_STATUSES } from "@/lib/types";
import type { ClientStatus } from "@/lib/types";
import { checklistStatus } from "@/lib/documents";
import { assertSameOrigin } from "@/lib/security";
import { canTransition } from "@/lib/status";
import {
  canAssignPreparer,
  canChangeClientStatus,
  canEditStaffNotes,
} from "@/lib/staff";

const patchSchema = z
  .object({
    status: z.enum(CLIENT_STATUSES).optional(),
    staff_notes: z.string().max(10000).nullable().optional(),
    tax_year: z.number().int().min(2000).max(2100).nullable().optional(),
    assigned_preparer_id: z.string().max(200).nullable().optional(),
    assigned_preparer_name: z.string().max(200).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field required",
  });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await getAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const client = await getClientById(id);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const supabase = createAdminClient();
    const { data: signatures } = await supabase
      .from("e_signatures")
      .select("id,typed_name,method,ip,signed_at")
      .eq("client_id", id)
      .order("signed_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      client,
      checklist: checklistStatus(client.documents || []),
      signatures: signatures || [],
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
      },
    });
  } catch (error) {
    console.error("Client fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const staff = await getAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const client = await getClientById(id);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const oldStatus = client.status as ClientStatus;
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      if (!canChangeClientStatus(staff.role)) {
        return NextResponse.json(
          { error: "Your role cannot change client status" },
          { status: 403 }
        );
      }
      if (!canTransition(oldStatus, body.status, "any")) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.staff_notes !== undefined) {
      if (!canEditStaffNotes(staff.role)) {
        return NextResponse.json(
          { error: "Your role cannot edit staff notes" },
          { status: 403 }
        );
      }
      updates.staff_notes = body.staff_notes;
    }

    if (body.tax_year !== undefined) updates.tax_year = body.tax_year;

    if (
      body.assigned_preparer_id !== undefined ||
      body.assigned_preparer_name !== undefined
    ) {
      if (!canAssignPreparer(staff.role)) {
        return NextResponse.json(
          { error: "Only owners can assign preparers" },
          { status: 403 }
        );
      }
      if (body.assigned_preparer_id !== undefined) {
        updates.assigned_preparer_id = body.assigned_preparer_id;
      }
      if (body.assigned_preparer_name !== undefined) {
        updates.assigned_preparer_name = body.assigned_preparer_name;
      }
    }

    // Reset signature fields if moving away from ready_for_signature / filed
    if (
      body.status &&
      body.status !== "ready_for_signature" &&
      body.status !== "filed" &&
      (oldStatus === "ready_for_signature" || oldStatus === "filed")
    ) {
      updates.signature_acknowledged_at = null;
      updates.signed_at = null;
      updates.signature_typed_name = null;
      updates.signature_method = null;
    }

    const supabase = createAdminClient();
    const { data: updated, error } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    if (body.status && oldStatus !== body.status) {
      await onStatusChanged(updated, body.status as ClientStatus, oldStatus);
      await logActivity({
        clientId: id,
        action: "status_changed",
        description: `Status ${oldStatus} → ${body.status} by ${staff.name}`,
        metadata: { from: oldStatus, to: body.status, staff_id: staff.id },
      });
    }

    if (body.staff_notes !== undefined && body.staff_notes !== client.staff_notes) {
      await logActivity({
        clientId: id,
        action: "staff_notes_updated",
        description: `Staff notes updated by ${staff.name}`,
      });
    }

    if (body.tax_year !== undefined && body.tax_year !== client.tax_year) {
      await logActivity({
        clientId: id,
        action: "tax_year_updated",
        description: `Tax year set to ${body.tax_year}`,
        metadata: { tax_year: body.tax_year },
      });
    }

    if (
      body.assigned_preparer_name !== undefined &&
      body.assigned_preparer_name !== client.assigned_preparer_name
    ) {
      await logActivity({
        clientId: id,
        action: "preparer_assigned",
        description: `Assigned preparer: ${body.assigned_preparer_name || "none"}`,
      });
    }

    return NextResponse.json({ client: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Client update error:", error);
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}
