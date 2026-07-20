import { describe, it, expect } from "vitest";
import { rateLimitInMemory } from "@/lib/rate-limit";

describe("rate limit memory", () => {
  it("allows up to limit then blocks", () => {
    const store = new Map();
    const now = 1_000_000;
    expect(rateLimitInMemory(store, "k", 3, 60_000, now).ok).toBe(true);
    expect(rateLimitInMemory(store, "k", 3, 60_000, now).ok).toBe(true);
    expect(rateLimitInMemory(store, "k", 3, 60_000, now).ok).toBe(true);
    const blocked = rateLimitInMemory(store, "k", 3, 60_000, now);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after window", () => {
    const store = new Map();
    const now = 1_000_000;
    rateLimitInMemory(store, "k", 1, 1000, now);
    expect(rateLimitInMemory(store, "k", 1, 1000, now).ok).toBe(false);
    expect(rateLimitInMemory(store, "k", 1, 1000, now + 1001).ok).toBe(true);
  });
});
