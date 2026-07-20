import { createAdminClient } from "./supabase/admin";
import { REQUIRED_DOCUMENTS } from "./constants";
import {
  decryptDocumentBuffer,
  encryptDocumentBuffer,
  sanitizeDownloadFilename,
  validateFileMagic,
} from "./crypto-docs";
import { v4 as uuidv4 } from "uuid";
import { getClientIp } from "./rate-limit";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
]);

export const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);

export const DOCUMENT_CATEGORIES = [
  ...REQUIRED_DOCUMENTS,
  {
    id: "return_draft",
    label: "Return for Review",
    description: "Draft or final return uploaded by staff for signature",
  },
] as const;

export type DocumentCategoryId = (typeof DOCUMENT_CATEGORIES)[number]["id"];

export function isAllowedUpload(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "File too large (max 10MB)" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const mimeOk = ALLOWED_MIME_TYPES.has(file.type) || file.type === "";
  const extOk = ALLOWED_EXTENSIONS.has(ext);

  if (!mimeOk && !extOk) {
    return { ok: false, error: "Only PDF, JPG, and PNG files are allowed" };
  }
  if (!extOk) {
    return { ok: false, error: "Only PDF, JPG, and PNG files are allowed" };
  }

  return { ok: true };
}

export function isValidCategory(category: string | null | undefined): boolean {
  if (!category) return true;
  return DOCUMENT_CATEGORIES.some((c) => c.id === category);
}

/** Public-safe document fields (never expose storage path / crypto material) */
export function toPublicDocument(doc: Record<string, unknown>) {
  return {
    id: doc.id,
    client_id: doc.client_id,
    name: doc.name,
    file_size: doc.file_size,
    mime_type: doc.mime_type,
    category: doc.category,
    uploaded_at: doc.uploaded_at,
    encrypted: doc.encrypted ?? true,
  };
}

/**
 * Opaque storage path — no original filename, no client-readable extension.
 * Path alone cannot be guessed without the UUID.
 */
export function buildOpaqueStoragePath(clientId: string): string {
  return `enc/${clientId}/${uuidv4()}.bin`;
}

export async function storeEncryptedDocument({
  clientId,
  fileName,
  mimeType,
  plainBuffer,
  category,
}: {
  clientId: string;
  fileName: string;
  mimeType: string;
  plainBuffer: Buffer;
  category: string | null;
}) {
  const magic = validateFileMagic(plainBuffer, mimeType, fileName);
  if (!magic.ok) {
    throw new Error(magic.error);
  }

  const { ciphertext, iv, authTag } = encryptDocumentBuffer(plainBuffer);
  const filePath = buildOpaqueStoragePath(clientId);
  const supabase = createAdminClient();

  const { error: uploadError } = await supabase.storage
    .from("client-documents")
    .upload(filePath, ciphertext, {
      contentType: "application/octet-stream",
      upsert: false,
      cacheControl: "private, no-store",
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(
      "Upload failed. Ensure the private 'client-documents' bucket exists."
    );
  }

  const { data: doc, error: dbError } = await supabase
    .from("documents")
    .insert({
      client_id: clientId,
      name: fileName,
      file_path: filePath,
      file_size: plainBuffer.length,
      mime_type: mimeType || "application/octet-stream",
      category,
      encrypted: true,
      encryption_iv: iv,
      encryption_auth_tag: authTag,
    })
    .select(
      "id, client_id, name, file_size, mime_type, category, uploaded_at, encrypted"
    )
    .single();

  if (dbError) {
    // Best-effort cleanup of orphaned blob
    await supabase.storage.from("client-documents").remove([filePath]);
    throw dbError;
  }

  return doc;
}

export async function loadAndDecryptDocument(doc: {
  file_path: string;
  encrypted?: boolean | null;
  encryption_iv?: string | null;
  encryption_auth_tag?: string | null;
  mime_type?: string | null;
  name: string;
}): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("client-documents")
    .download(doc.file_path);

  if (error || !data) {
    console.error("Storage download error:", error);
    throw new Error("Failed to retrieve document");
  }

  const raw = Buffer.from(await data.arrayBuffer());
  const isEncrypted = doc.encrypted !== false && !!doc.encryption_iv;

  let buffer: Buffer;
  if (isEncrypted) {
    if (!doc.encryption_iv || !doc.encryption_auth_tag) {
      throw new Error("Document encryption metadata missing");
    }
    buffer = decryptDocumentBuffer(
      raw,
      doc.encryption_iv,
      doc.encryption_auth_tag
    );
  } else {
    // Legacy plaintext uploads (pre-encryption)
    buffer = raw;
  }

  return {
    buffer,
    mimeType: doc.mime_type || "application/octet-stream",
    filename: sanitizeDownloadFilename(doc.name),
  };
}

export async function logDocumentAccess({
  documentId,
  clientId,
  actorType,
  actorId,
  request,
  action = "download",
}: {
  documentId: string;
  clientId: string;
  actorType: "client" | "admin";
  actorId?: string | null;
  request?: Request;
  action?: string;
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from("document_access_log").insert({
      document_id: documentId,
      client_id: clientId,
      actor_type: actorType,
      actor_id: actorId || null,
      action,
      ip: request ? getClientIp(request) : null,
      user_agent: request?.headers.get("user-agent")?.slice(0, 500) || null,
    });
  } catch (err) {
    // Don't fail the download if logging table is missing
    console.error("document_access_log insert failed:", err);
  }
}

/** @deprecated Prefer streaming through API — never give long-lived public storage URLs */
export async function createDocumentSignedUrl(
  filePath: string,
  expiresInSec = 60
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("client-documents")
    .createSignedUrl(filePath, expiresInSec);

  if (error || !data?.signedUrl) {
    console.error("Signed URL error:", error);
    return null;
  }
  return data.signedUrl;
}

export function checklistStatus(
  documents: { category?: string | null; name?: string }[]
): {
  id: string;
  label: string;
  description: string;
  satisfied: boolean;
}[] {
  return REQUIRED_DOCUMENTS.map((req) => {
    const satisfied = documents.some(
      (d) =>
        d.category === req.id ||
        (d.name && d.name.toLowerCase().includes(req.id.replace("_", "")))
    );
    return { ...req, satisfied };
  });
}
