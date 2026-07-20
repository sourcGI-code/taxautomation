import { describe, it, expect } from "vitest";
import {
  buildSignatureAudit,
  validateSignatureInput,
} from "@/lib/esign";

describe("e-sign validation", () => {
  it("requires agreement and matching name", () => {
    const fail = validateSignatureInput({
      typedName: "Wrong Name",
      clientLegalName: "Jaxon McCollum",
      agreedToElectronicSignature: true,
    });
    expect(fail.ok).toBe(false);

    const noAgree = validateSignatureInput({
      typedName: "Jaxon McCollum",
      clientLegalName: "Jaxon McCollum",
      agreedToElectronicSignature: false as unknown as true,
    });
    expect(noAgree.ok).toBe(false);
  });

  it("accepts matching typed name", () => {
    const ok = validateSignatureInput({
      typedName: "Jaxon McCollum",
      clientLegalName: "Jaxon McCollum",
      agreedToElectronicSignature: true,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.method).toBe("typed");
    }
  });

  it("accepts first+last match", () => {
    const ok = validateSignatureInput({
      typedName: "Jaxon R McCollum",
      clientLegalName: "Jaxon McCollum",
      agreedToElectronicSignature: true,
    });
    // first and last tokens match ends
    expect(ok.ok).toBe(true);
  });

  it("builds audit without throwing", () => {
    const valid = validateSignatureInput({
      typedName: "Ada Lovelace",
      clientLegalName: "Ada Lovelace",
      agreedToElectronicSignature: true,
    });
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    const audit = buildSignatureAudit({
      clientId: "c1",
      ip: "1.2.3.4",
      userAgent: "vitest",
      valid: valid.value,
    });
    expect(audit.typed_name).toBe("Ada Lovelace");
    expect(audit.ip).toBe("1.2.3.4");
  });
});
