import { describe, expect, it } from "vitest";
import {
  dayKeyLocal,
  localMidnightUTC,
  localTimeToUTC,
  minutesToClock,
  slotLabel,
  weekdayOfDateKey,
} from "@/lib/datetime";

// Africa/Lagos is UTC+1 year-round (no DST) — easy to assert.
const TZ = "Africa/Lagos";

describe("minutesToClock", () => {
  it("formats minutes since midnight as HH:MM", () => {
    expect(minutesToClock(0)).toBe("00:00");
    expect(minutesToClock(480)).toBe("08:00");
    expect(minutesToClock(1020)).toBe("17:00");
    expect(minutesToClock(585)).toBe("09:45");
  });
});

describe("weekdayOfDateKey", () => {
  it("resolves local calendar weekday", () => {
    // 2026-09-25 is a Friday.
    expect(weekdayOfDateKey("2026-09-25", TZ)).toBe(5);
    // 2026-09-20 is a Sunday.
    expect(weekdayOfDateKey("2026-09-20", TZ)).toBe(0);
  });
});

describe("localMidnightUTC", () => {
  it("converts a local date to the UTC instant of local midnight", () => {
    // Local 2026-09-25 00:00 in UTC+1 = 2026-09-24 23:00 UTC.
    expect(localMidnightUTC("2026-09-25", TZ)).toBe(
      Date.UTC(2026, 8, 24, 23, 0, 0),
    );
  });
});

describe("localTimeToUTC", () => {
  it("converts local minutes-of-day to a UTC instant", () => {
    // 08:00 local on 2026-09-25 = 07:00 UTC.
    expect(localTimeToUTC("2026-09-25", 480, TZ).toISOString()).toBe(
      "2026-09-25T07:00:00.000Z",
    );
    // 17:00 local = 16:00 UTC.
    expect(localTimeToUTC("2026-09-25", 1020, TZ).toISOString()).toBe(
      "2026-09-25T16:00:00.000Z",
    );
  });
});

describe("dayKeyLocal & slotLabel", () => {
  it("derives local date key from a UTC instant", () => {
    expect(dayKeyLocal(new Date("2026-09-25T07:00:00.000Z"), TZ)).toBe(
      "2026-09-25",
    );
    // 23:30 UTC = 00:30 local (next day).
    expect(dayKeyLocal(new Date("2026-09-25T23:30:00.000Z"), TZ)).toBe(
      "2026-09-26",
    );
  });

  it("builds reader-friendly slot labels", () => {
    // 08:00 UTC = 09:00 local.
    expect(slotLabel(new Date("2026-09-25T08:00:00.000Z"))).toContain("09:00");
  });
});