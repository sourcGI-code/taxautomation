import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertProductionSecrets, assertSameOrigin } from "@/lib/security";

function mockRequest(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
  } as Request;
}

describe("security helpers", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("assertSameOrigin checks host", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://taxes.example.com";
    expect(
      assertSameOrigin(
        mockRequest({ origin: "https://taxes.example.com" })
      )
    ).toBe(true);
    expect(
      assertSameOrigin(mockRequest({ origin: "https://evil.com" }))
    ).toBe(false);
    expect(
      assertSameOrigin(
        mockRequest({ referer: "https://taxes.example.com/portal" })
      )
    ).toBe(true);
  });

  it("production secret checks", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    delete process.env.DOCUMENT_ENCRYPTION_KEY;
    delete process.env.CRON_SECRET;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_HASH;
    const result = assertProductionSecrets();
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(2);
  });

  it("dev mode skips production secret hard-fail", () => {
    process.env.NODE_ENV = "development";
    const result = assertProductionSecrets();
    expect(result.ok).toBe(true);
  });
});
