/**
 * Pure booking helpers (unit-testable, no DB).
 */

export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return {
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0,
  };
}

export function toMs(iso: string): number {
  return new Date(iso).getTime();
}

/** True if [slotStart, slotEnd) overlaps any booked interval */
export function slotOverlapsBooking(
  slotStart: Date,
  slotEnd: Date,
  booked: { starts_at: string; ends_at: string }[]
): boolean {
  const start = slotStart.getTime();
  const end = slotEnd.getTime();
  if (!(end > start)) return true; // invalid slot blocks itself
  return booked.some((b) => start < toMs(b.ends_at) && end > toMs(b.starts_at));
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Normalize email for client identity matching */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Basic phone digit count (US-ish leniency) */
export function isPlausiblePhone(phone: string | undefined | null): boolean {
  if (!phone) return true;
  const digits = phone.replace(/\D/g, "");
  return digits.length === 0 || (digits.length >= 10 && digits.length <= 15);
}
