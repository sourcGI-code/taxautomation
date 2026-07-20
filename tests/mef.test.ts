import { describe, it, expect } from "vitest";
import { validateMefReturn, validRoutingChecksum } from "@/lib/mef/validate";
import { buildMefPackage, generateSubmissionId, redactSsnInXml } from "@/lib/mef/package";
import { transmitMefPackage } from "@/lib/mef/transmit";
import type { MefReturnPayload } from "@/lib/mef/types";

const basePayload = (): MefReturnPayload => ({
  taxYear: 2025,
  formType: "1040",
  taxpayer: {
    firstName: "Jane",
    lastName: "Doe",
    ssnFull: "123456789",
    filingStatus: "Single",
    address: {
      street: "1 Main St",
      city: "Wabash",
      state: "IN",
      zip: "46992",
    },
  },
  income: { wages: 55000 },
  deductions: { standardOrItemized: "standard", amount: 14600 },
  tax: { totalTax: 5000, withholdings: 6000, refundOrOwe: 1000 },
  preparer: { name: "Pat Preparer", ptin: "P12345678", efin: "123456" },
});

describe("MeF validation", () => {
  it("accepts a complete return", () => {
    const r = validateMefReturn(basePayload());
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejects bad state and zip", () => {
    const p = basePayload();
    p.taxpayer.address.state = "XX";
    p.taxpayer.address.zip = "12";
    const r = validateMefReturn(p);
    expect(r.ok).toBe(false);
  });

  it("validates routing checksum", () => {
    expect(validRoutingChecksum("021000021")).toBe(true);
    expect(validRoutingChecksum("123456789")).toBe(false);
  });
});

describe("MeF package", () => {
  it("builds XML and redacts SSN", () => {
    const id = generateSubmissionId("123456");
    const { returnXml, manifestXml, contentHash } = buildMefPackage(basePayload(), {
      submissionId: id,
      efin: "123456",
      etin: "12345",
      environment: "sandbox",
    });
    expect(returnXml).toContain("ReturnHeader");
    expect(manifestXml).toContain(id);
    expect(contentHash).toHaveLength(64);
    expect(redactSsnInXml(returnXml)).not.toContain("123456789");
  });
});

describe("MeF transmit sandbox", () => {
  it("accepts valid package in sandbox", async () => {
    const id = generateSubmissionId("123456");
    const { returnXml, manifestXml } = buildMefPackage(basePayload(), {
      submissionId: id,
      efin: "123456",
      etin: "12345",
      environment: "sandbox",
    });
    const result = await transmitMefPackage({
      submissionId: id,
      returnXml,
      manifestXml,
      forceSandbox: true,
    });
    expect(result.environment).toBe("sandbox");
    expect(result.status).toBe("accepted");
    expect(result.ok).toBe(true);
  });
});
