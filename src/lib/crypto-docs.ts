import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Document encryption at rest.
 * - Files in storage are ciphertext only (opaque .bin paths)
 * - Master key from DOCUMENT_ENCRYPTION_KEY (64 hex chars recommended)
 * - Staff + authenticated client decrypt only through the app API (never public URLs)
 *
 * This is NOT "unhackable" — it means a storage leak alone is not enough to read files
 * without also stealing the app master key from your server env.
 */

export function isDocumentEncryptionConfigured(): boolean {
  return !!process.env.DOCUMENT_ENCRYPTION_KEY?.trim();
}

export function getDocumentEncryptionKey(): Buffer {
  const raw = process.env.DOCUMENT_ENCRYPTION_KEY?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DOCUMENT_ENCRYPTION_KEY is required in production (openssl rand -hex 32)"
      );
    }
    // Dev fallback — deterministic from SESSION_SECRET so local works without extra env
    const fallback =
      process.env.SESSION_SECRET || "dev-only-document-encryption-key";
    return createHash("sha256").update(`doc-enc:${fallback}`).digest();
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // Allow passphrase-style keys: derive 32 bytes
  return createHash("sha256").update(raw).digest();
}

export type EncryptedBlob = {
  ciphertext: Buffer;
  iv: string; // base64
  authTag: string; // base64
};

export function encryptDocumentBuffer(plaintext: Buffer): EncryptedBlob {
  const key = getDocumentEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptDocumentBuffer(
  ciphertext: Buffer,
  ivB64: string,
  authTagB64: string
): Buffer {
  const key = getDocumentEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Validate file magic bytes match claimed type (anti-extension spoofing) */
export function validateFileMagic(
  buffer: Buffer,
  mimeType: string,
  filename: string
): { ok: true } | { ok: false; error: string } {
  if (buffer.length < 4) {
    return { ok: false, error: "File is empty or too small" };
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const isPdf =
    mimeType === "application/pdf" ||
    ext === "pdf" ||
    buffer.subarray(0, 4).toString("ascii") === "%PDF";
  const isJpeg =
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg" ||
    ext === "jpg" ||
    ext === "jpeg" ||
    (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff);
  const isPng =
    mimeType === "image/png" ||
    ext === "png" ||
    (buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47);

  if (isPdf) {
    if (buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
      return { ok: false, error: "File content is not a valid PDF" };
    }
    return { ok: true };
  }
  if (isJpeg) {
    if (!(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) {
      return { ok: false, error: "File content is not a valid JPEG" };
    }
    return { ok: true };
  }
  if (isPng) {
    if (
      !(
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      )
    ) {
      return { ok: false, error: "File content is not a valid PNG" };
    }
    return { ok: true };
  }

  return { ok: false, error: "Unrecognized or disallowed file type" };
}

/** Safe Content-Disposition filename (no path traversal, no control chars) */
export function sanitizeDownloadFilename(name: string): string {
  const leaf = name.split(/[/\\]/).pop() || "document";
  const base = leaf
    .replace(/\.\./g, "")
    .replace(/[^\w.\- ()[\]]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 180);
  return base || "document";
}
