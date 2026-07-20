import { CLIENT_STATUSES, type ClientStatus } from "./types";
import { STATUS_ORDER } from "./constants";

/** Pipeline order is the source of truth for progress math */
const ORDER = STATUS_ORDER;

export function isClientStatus(value: unknown): value is ClientStatus {
  return (
    typeof value === "string" &&
    (CLIENT_STATUSES as readonly string[]).includes(value)
  );
}

export function statusIndex(status: ClientStatus): number {
  return ORDER.indexOf(status);
}

/** 0–100 based on pipeline position (filed = 100) */
export function pipelineProgress(status: ClientStatus): number {
  const idx = statusIndex(status);
  if (idx < 0) return 0;
  if (ORDER.length <= 1) return 100;
  return Math.round((idx / (ORDER.length - 1)) * 100);
}

export function suggestedNextStatus(
  status: ClientStatus
): ClientStatus | null {
  const idx = statusIndex(status);
  if (idx < 0 || idx >= ORDER.length - 1) return null;
  return ORDER[idx + 1] ?? null;
}

export type TransitionMode = "forward" | "any" | "strict_forward";

/**
 * Validate status changes.
 * - strict_forward: only next step
 * - forward: any later status (skip allowed)
 * - any: any valid status including backward (staff override)
 */
export function canTransition(
  from: ClientStatus,
  to: ClientStatus,
  mode: TransitionMode = "any"
): boolean {
  if (!isClientStatus(from) || !isClientStatus(to)) return false;
  if (from === to) return true;

  const fromIdx = statusIndex(from);
  const toIdx = statusIndex(to);
  if (fromIdx < 0 || toIdx < 0) return false;

  if (mode === "any") return true;
  if (mode === "strict_forward") return toIdx === fromIdx + 1;
  return toIdx > fromIdx;
}

export function transitionError(
  from: ClientStatus,
  to: ClientStatus,
  mode: TransitionMode = "any"
): string | null {
  if (canTransition(from, to, mode)) return null;
  if (mode === "strict_forward") {
    return `Status must move from "${from}" to the next step only`;
  }
  if (mode === "forward") {
    return `Cannot move status backward from "${from}" to "${to}"`;
  }
  return `Invalid status transition from "${from}" to "${to}"`;
}

/** Onboarding step progression helpers */
export const ONBOARDING_PROGRESSION = [
  "welcome_sent",
  "intake_pending",
  "intake_complete",
  "documents_pending",
  "documents_complete",
  "done",
] as const;

export function isLaterOrEqualOnboarding(
  current: string,
  target: (typeof ONBOARDING_PROGRESSION)[number]
): boolean {
  const a = ONBOARDING_PROGRESSION.indexOf(
    current as (typeof ONBOARDING_PROGRESSION)[number]
  );
  const b = ONBOARDING_PROGRESSION.indexOf(target);
  if (a < 0 || b < 0) return false;
  return a >= b;
}
