import { describe, it, expect } from "vitest";
import {
  isDocuSignConfigured,
  mapDocuSignStatus,
  createEnvelope,
  verifyDocuSignConnectHmac,
} from "@/lib/docusign/client";

describe("DocuSign client", () => {
  it("maps statuses", () => {
    expect(mapDocuSignStatus("completed")).toBe("completed");
    expect(mapDocuSignStatus("sent")).toBe("sent");
    expect(mapDocuSignStatus("declined")).toBe("declined");
  });

  it("simulates envelope when not configured", async () => {
    // Ensure unconfigured
    delete process.env.DOCUSIGN_INTEGRATION_KEY;
    delete process.env.DOCUSIGN_ACCESS_TOKEN;
    expect(isDocuSignConfigured()).toBe(false);

    const env = await createEnvelope({
      signerEmail: "a@b.com",
      signerName: "Ada",
      subject: "Sign",
      emailBlurb: "Please sign",
      documentBase64: Buffer.from("%PDF").toString("base64"),
      documentName: "a.pdf",
      documentExtension: "pdf",
      clientUserId: "client-1",
      returnUrl: "http://localhost:3000/portal",
    });
    expect(env.simulated).toBe(true);
    expect(env.envelopeId.startsWith("SIM-")).toBe(true);
    expect(env.signingUrl).toBeTruthy();
  });

  it("allows connect without secret in non-production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    delete process.env.DOCUSIGN_CONNECT_SECRET;
    expect(verifyDocuSignConnectHmac("{}", null)).toBe(true);
    process.env.NODE_ENV = prev;
  });
});
