// Timezone-safe helpers. All Date instants are UTC; all "local" notions are
// expressed in the clinic timezone (site.timeZone, Africa/Lagos by default).
import { site, formatTime } from "./site";

/**
 * Offset (ms) of `timeZone` behind/ ahead of UTC at the given instant.
 * Positive when the timezone is ahead of UTC.
 */
export function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUTC - date.getTime();
}

/**
 * Millisecond epoch of the start (00:00 local) of `dateKey` ("YYYY-MM-DD")
 * in the clinic timezone.
 */
export function localMidnightUTC(dateKey: string, timeZone: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const approx = Date.UTC(y, m - 1, d);
  // Two-pass offset resolution stays correct across DST transitions.
  const offset1 = tzOffsetMs(new Date(approx), timeZone);
  const offset2 = tzOffsetMs(new Date(approx - offset1), timeZone);
  return approx - offset2;
}

/** Build a UTC Date for a local date + "minutes since local midnight". */
export function localTimeToUTC(
  dateKey: string,
  minutesOfDay: number,
  timeZone: string,
): Date {
  return new Date(localMidnightUTC(dateKey, timeZone) + minutesOfDay * 60_000);
}

/** Local calendar date key ("YYYY-MM-DD") of a UTC instant, in clinic tz. */
export function dayKeyLocal(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Weekday (0 = Sunday … 6 = Saturday) of a local date key, in clinic tz. */
export function weekdayOfDateKey(dateKey: string, timeZone: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const wd = dtf.formatToParts(new Date(Date.UTC(y, m - 1, d))).find((p) => p.type === "weekday")!
    .value;
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[wd] ?? 0;
}

/** Local date key N calendar days from today (clinic tz). */
export function dayKeyFromNow(daysFromToday: number, timeZone: string): string {
  const now = new Date();
  const todayKey = dayKeyLocal(now, timeZone);
  const [y, m, d] = todayKey.split("-").map(Number);
  const local = new Date(Date.UTC(y, m - 1, d)) as Date;
  const plus = new Date(local);
  plus.setUTCDate(local.getUTCDate() + daysFromToday);
  return `${plus.getUTCFullYear()}-${String(plus.getUTCMonth() + 1).padStart(2, "0")}-${String(plus.getUTCDate()).padStart(2, "0")}`;
}

/** Shift a local date key ("YYYY-MM-DD") by a whole number of days. */
export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Human label for a slot instant, e.g. "Fri, 25 Sep · 09:00". */
export function slotLabel(date: Date): string {
  const d = new Intl.DateTimeFormat(site.locale, {
    timeZone: site.timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  return `${d} · ${formatTime(date)}`;
}