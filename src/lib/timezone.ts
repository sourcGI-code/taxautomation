import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import { addDays, addMinutes } from "date-fns";

/** Business hours timezone — always show & book in this zone */
export function getPracticeTimezone(): string {
  return (
    process.env.NEXT_PUBLIC_PRACTICE_TIMEZONE ||
    process.env.PRACTICE_TIMEZONE ||
    "America/New_York"
  );
}

/**
 * Build a Date for a calendar day + wall-clock time in the practice timezone.
 * Example: wallTime("2026-07-14", 9, 0) → Jul Tuesday 9:00 AM ET as UTC Instant
 */
export function wallTime(
  dateStr: string,
  hours: number,
  minutes: number,
  timeZone = getPracticeTimezone()
): Date {
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return fromZonedTime(`${dateStr}T${hh}:${mm}:00`, timeZone);
}

/** Calendar date (yyyy-MM-dd) for an instant in the practice timezone */
export function calendarDateInPractice(
  date: string | Date,
  timeZone = getPracticeTimezone()
): string {
  return formatInTimeZone(new Date(date), timeZone, "yyyy-MM-dd");
}

/** Day of week (0=Sun…6=Sat) for a calendar date in practice timezone */
export function dayOfWeekInPractice(
  dateStr: string,
  timeZone = getPracticeTimezone()
): number {
  // Noon avoids DST edge cases when converting date-only → zoned
  return toZonedTime(wallTime(dateStr, 12, 0, timeZone), timeZone).getDay();
}

export function todayInPractice(timeZone = getPracticeTimezone()): string {
  return formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
}

export function addCalendarDays(dateStr: string, days: number): string {
  // Interpret as noon local practice time, add days, format back
  const noon = wallTime(dateStr, 12, 0);
  return calendarDateInPractice(addDays(noon, days));
}

export function addMinutesToDate(date: Date, minutes: number): Date {
  return addMinutes(date, minutes);
}
