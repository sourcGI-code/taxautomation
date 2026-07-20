import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadAndDecryptDocument,
  logDocumentAccess,
} from "@/lib/documents";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Staff download: decrypt server-side, audit, stream attachment.
 * Encrypted blobs never leave storage in readable form via signed URLs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ip = getClientIp(request);
    const limited = await rateLimit(`admin-doc-dl:${ip}`, 60, 60 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Too many downloads" }, { status: 429 });
    }

    const { id } = await params;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const supabase = createAdminClient();
    const { data: doc } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { buffer, mimeType, filename } = await loadAndDecryptDocument(doc);

    await logDocumentAccess({
      documentId: doc.id,
      clientId: doc.client_id,
      actorType: "admin",
      actorId: "admin",
      request,
      action: "download",
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Admin document download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
