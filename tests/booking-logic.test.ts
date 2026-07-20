import { describe, it, expect } from "vitest";
import {
  intervalsOverlap,
  isPlausiblePhone,
  normalizeEmail,
  parseTime,
  slotOverlapsBooking,
} from "@/lib/booking-logic";

describe("booking-logic", () => {
  it("parses times", () => {
    expect(parseTime("09:00:00")).toEqual({ hours: 9, minutes: 0 });
    expect(parseTime("17:30")).toEqual({ hours: 17, minutes: 30 });
  });

  it("detects overlapping slots", () => {
    const booked = [
      {
        starts_at: "2026-03-10T15:00:00.000Z",
        ends_at: "2026-03-10T15:30:00.000Z",
      },
    ];
    const overlap = slotOverlapsBooking(
      new Date("2026-03-10T15:15:00.000Z"),
      new Date("2026-03-10T15:45:00.000Z"),
      booked
    );
    const free = slotOverlapsBooking(
      new Date("2026-03-10T15:30:00.000Z"),
      new Date("2026-03-10T16:00:00.000Z"),
      booked
    );
    expect(overlap).toBe(true);
    expect(free).toBe(false);
  });

  it("interval helpers", () => {
    expect(intervalsOverlap(0, 10, 5, 15)).toBe(true);
    expect(intervalsOverlap(0, 10, 10, 20)).toBe(false);
  });

  it("normalizes email and phone", () => {
    expect(normalizeEmail("  A@B.COM ")).toBe("a@b.com");
    expect(isPlausiblePhone("+1 (555) 123-4567")).toBe(true);
    expect(isPlausiblePhone("123")).toBe(false);
    expect(isPlausiblePhone(undefined)).toBe(true);
  });
});
