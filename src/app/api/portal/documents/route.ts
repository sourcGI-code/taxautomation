import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { onDocumentUploaded } from "@/lib/notifications";
import {
  isAllowedUpload,
  isValidCategory,
  checklistStatus,
  storeEncryptedDocument,
  toPublicDocument,
} from "@/lib/documents";
import { assertSameOrigin } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const client = await getAuthenticatedClient();
    if (!client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: documents } = await supabase
      .from("documents")
      .select(
        "id, client_id, name, file_size, mime_type, category, uploaded_at, encrypted"
      )
      .eq("client_id", client.id)
      .order("uploaded_at", { ascending: false });

    return NextResponse.json({
      documents: (documents || []).map((d) => toPublicDocument(d)),
      checklist: checklistStatus(documents || []),
    });
  } catch (error) {
    console.error("Documents list error:", error);
    return NextResponse.json({ error: "Failed to list documents" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await getAuthenticatedClient();
    if (!client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await rateLimit(`upload:${client.id}`, 30, 60 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Upload rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string | null) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowed = isAllowedUpload({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.error }, { status: 400 });
    }

    if (!isValidCategory(category)) {
      return NextResponse.json({ error: "Invalid document category" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const doc = await storeEncryptedDocument({
      clientId: client.id,
      fileName: file.name.slice(0, 200),
      mimeType: file.type,
      plainBuffer: buffer,
      category,
    });

    await onDocumentUploaded(client, file.name);

    return NextResponse.json({
      success: true,
      document: toPublicDocument(doc as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error && error.message.includes("valid")
        ? error.message
        : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
