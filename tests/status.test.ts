import { describe, it, expect } from "vitest";
import {
  canTransition,
  isClientStatus,
  pipelineProgress,
  suggestedNextStatus,
  transitionError,
} from "@/lib/status";

describe("status pipeline", () => {
  it("recognizes valid statuses", () => {
    expect(isClientStatus("booked")).toBe(true);
    expect(isClientStatus("filed")).toBe(true);
    expect(isClientStatus("nope")).toBe(false);
  });

  it("allows any transition in admin mode", () => {
    expect(canTransition("filed", "booked", "any")).toBe(true);
    expect(canTransition("booked", "filed", "any")).toBe(true);
  });

  it("enforces strict forward", () => {
    expect(canTransition("booked", "intake_complete", "strict_forward")).toBe(
      true
    );
    expect(canTransition("booked", "in_review", "strict_forward")).toBe(false);
  });

  it("enforces forward (skip ok, no backward)", () => {
    expect(canTransition("booked", "in_review", "forward")).toBe(true);
    expect(canTransition("in_review", "booked", "forward")).toBe(false);
  });

  it("computes progress and next status", () => {
    expect(pipelineProgress("booked")).toBe(0);
    expect(pipelineProgress("filed")).toBe(100);
    expect(suggestedNextStatus("booked")).toBe("intake_complete");
    expect(suggestedNextStatus("filed")).toBe(null);
  });

  it("returns transition errors", () => {
    expect(transitionError("filed", "booked", "forward")).toMatch(/backward/i);
    expect(transitionError("booked", "intake_complete", "any")).toBe(null);
  });
});
