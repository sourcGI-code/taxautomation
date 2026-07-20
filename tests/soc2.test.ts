import { describe, it, expect } from "vitest";
import { SOC2_CONTROLS, getControl, controlsByCategory } from "@/lib/soc2/controls";
import { runSoc2Assessment } from "@/lib/soc2/assessment";

describe("SOC2 controls catalog", () => {
  it("has core TSC controls", () => {
    expect(SOC2_CONTROLS.length).toBeGreaterThanOrEqual(10);
    expect(getControl("CC6.1")).toBeTruthy();
    expect(getControl("PI1.1")).toBeTruthy();
    const byCat = controlsByCategory();
    expect(byCat.CC?.length).toBeGreaterThan(0);
  });
});

describe("SOC2 assessment", () => {
  it("returns honest readiness report", async () => {
    process.env.NODE_ENV = "development";
    process.env.ADMIN_PASSWORD = "test-password-not-default";
    process.env.SESSION_SECRET = "x".repeat(32);

    const report = await runSoc2Assessment();
    expect(report.disclaimer.toLowerCase()).toContain("not a soc 2");
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.controls.length).toBe(SOC2_CONTROLS.length);
    expect(["not_ready", "partial", "audit_ready"]).toContain(report.readinessLabel);
  });
});
