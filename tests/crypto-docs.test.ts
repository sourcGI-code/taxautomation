import { describe, it, expect, beforeAll } from "vitest";
import {
  decryptDocumentBuffer,
  encryptDocumentBuffer,
  sanitizeDownloadFilename,
  validateFileMagic,
} from "@/lib/crypto-docs";

beforeAll(() => {
  process.env.DOCUMENT_ENCRYPTION_KEY = "a".repeat(64);
  process.env.NODE_ENV = "test";
});

describe("document crypto", () => {
  it("round-trips AES-GCM encryption", () => {
    const plain = Buffer.from("sensitive-tax-w2-content");
    const enc = encryptDocumentBuffer(plain);
    expect(enc.ciphertext.equals(plain)).toBe(false);
    const dec = decryptDocumentBuffer(enc.ciphertext, enc.iv, enc.authTag);
    expect(dec.toString()).toBe(plain.toString());
  });

  it("rejects tampered ciphertext", () => {
    const plain = Buffer.from("hello");
    const enc = encryptDocumentBuffer(plain);
    enc.ciphertext[0] ^= 0xff;
    expect(() =>
      decryptDocumentBuffer(enc.ciphertext, enc.iv, enc.authTag)
    ).toThrow();
  });

  it("validates magic bytes", () => {
    const pdf = Buffer.from("%PDF-1.4 rest");
    expect(validateFileMagic(pdf, "application/pdf", "a.pdf").ok).toBe(true);

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(validateFileMagic(jpeg, "image/jpeg", "a.jpg").ok).toBe(true);

    const spoof = Buffer.from("not a pdf");
    expect(validateFileMagic(spoof, "application/pdf", "a.pdf").ok).toBe(false);
  });

  it("sanitizes download names", () => {
    expect(sanitizeDownloadFilename("W-2 (John).pdf")).toContain("W-2");
    expect(sanitizeDownloadFilename("../../../etc/passwd")).not.toContain("..");
  });
});
