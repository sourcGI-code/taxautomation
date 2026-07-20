import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { evaluatePublishReadiness } from "@/lib/publish/evaluate";

describe("publish readiness", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.SESSION_SECRET = "x".repeat(40);
    process.env.DOCUMENT_ENCRYPTION_KEY = "a".repeat(64);
    process.env.ADMIN_PASSWORD = "strong-password-here";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_PRACTICE_NAME = "Test Practice";
    process.env.PRACTICE_EMAIL = "test@example.com";
    process.env.CRON_SECRET = "cron-secret";
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.PUBLISH_GO_LIVE;
    delete process.env.PUBLISH_AFFIRM_LEGAL_REVIEW;
  });

  it("blocks go-live without firm affirmations", () => {
    const report = evaluatePublishReadiness({
      dbOk: true,
      tablesOk: true,
      storageOk: true,
      emailOk: true,
      firmAffirmations: {
        legalReview: false,
        dataController: false,
        efilePolicy: false,
        insurance: false,
        goLive: false,
      },
    });
    expect(report.publishable).toBe(false);
    expect(report.blockers.some((b) => b.id.startsWith("legal."))).toBe(true);
  });

  it("is publishable when all blockers cleared", () => {
    const report = evaluatePublishReadiness({
      dbOk: true,
      dbDetail: "ok",
      tablesOk: true,
      tablesDetail: "ok",
      storageOk: true,
      storageDetail: "ok",
      emailOk: true,
      firmAffirmations: {
        legalReview: true,
        dataController: true,
        efilePolicy: true,
        insurance: true,
        goLive: true,
      },
    });
    expect(report.publishable).toBe(true);
    expect(report.blockers).toHaveLength(0);
    expect(report.summary).toMatch(/PUBLISHABLE/i);
  });
});
