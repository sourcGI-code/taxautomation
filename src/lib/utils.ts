import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getPracticeTimezone, wallTime } from "./timezone";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format dates/times in the practice timezone so booking UI never
 * shifts days (e.g. Tue 9am showing as Wed).
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  const timeZone = getPracticeTimezone();
  // Date-only keys like "2026-07-14" must be interpreted in practice timezone, not browser timezone
  const value =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? wallTime(date, 12, 0, timeZone)
      : new Date(date);

  return value.toLocaleDateString("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}

export function formatTime(date: string | Date) {
  const timeZone = getPracticeTimezone();
  const value =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? wallTime(date, 12, 0, timeZone)
      : new Date(date);

  return value.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(date: string | Date) {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

export function getAppUrl(path = "") {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
