import { format, formatDistanceToNow } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const MANILA_TZ = "Asia/Manila";

/**
 * Converts a UTC timestamp to Asia/Manila (GMT+8) and formats it.
 */
export function formatManila(
  date: string | Date,
  formatStr: string = "HH:mm:ss"
): string {
  const zonedDate = toZonedTime(
    typeof date === "string" ? new Date(date) : date,
    MANILA_TZ
  );
  return format(zonedDate, formatStr);
}

/**
 * Formats a UTC timestamp as a Manila-timezone time string (HH:mm:ss).
 */
export function formatManilaTime(
  date: string | Date,
  formatStr: string = "HH:mm:ss"
): string {
  return formatManila(date, formatStr);
}

/**
 * Formats a UTC timestamp as a Manila-timezone date string.
 */
export function formatManilaDate(
  date: string | Date,
  formatStr: string = "MMM dd, yyyy"
): string {
  return formatManila(date, formatStr);
}

/**
 * Formats a UTC timestamp as a Manila-timezone datetime string.
 */
export function formatManilaDateTime(
  date: string | Date,
  formatStr: string = "MMM dd, yyyy · HH:mm:ss"
): string {
  return formatManila(date, formatStr);
}

/**
 * Returns a relative time string (e.g., "2 minutes ago").
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Gets the current date boundaries in Manila timezone.
 * Returns UTC timestamps for the start and end of the current day in GMT+8.
 */
export function getManilaDayBounds(date?: Date): {
  start: string;
  end: string;
} {
  const now = date || new Date();
  const manilaDate = toZonedTime(now, MANILA_TZ);
  const dayStart = new Date(manilaDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(manilaDate);
  dayEnd.setHours(23, 59, 59, 999);

  return {
    start: dayStart.toISOString(),
    end: dayEnd.toISOString(),
  };
}

/**
 * Calculates seconds remaining in the undo grace window.
 */
export function getGraceSecondsRemaining(
  loggedAt: string,
  windowMinutes: number = 2
): number {
  const loggedDate = new Date(loggedAt);
  const expiresAt = new Date(loggedDate.getTime() + windowMinutes * 60 * 1000);
  const now = new Date();
  const remaining = Math.max(
    0,
    Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
  );
  return remaining;
}
