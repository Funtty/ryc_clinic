import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "./guards";
import type { SessionUser } from "./session";
import { site } from "@/lib/site";
import {
  addDaysToKey,
  dayKeyLocal,
  localMidnightUTC,
  weekdayOfDateKey,
} from "@/lib/datetime";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/constants";

/**
 * Calendar helpers powering /admin/calendar. A "day cell" aggregates how the
 * clinic operates on one local calendar day (open/closed, blocked) together
 * with what is booked that day (counts per status). Everything is computed
 * from the same sources as the booking engine: ClinicHours for opening hours,
 * BlockedDate for closures and Appointment rows for what is booked.
 */

export type DayCounts = {
  active: number;
  completed: number;
  cancelled: number;
  noShow: number;
};

export type DayCell = {
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  isOpenDay: boolean;
  clinicWideBlocked: boolean;
  dentistBlocked: boolean;
  counts: DayCounts;
  total: number;
};

export type WeekDentistRow = {
  id: string;
  name: string;
  slug: string;
  workingDays: number[]; // dayOfWeek values the dentist works (0 = Sunday)
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type BlockedInfo = {
  clinicWideKeys: Set<string>;
  dentistKeys: Set<string>;
  reasons: Map<string, string>;
};

async function loadBlocked(dateKeys: string[]): Promise<BlockedInfo> {
  if (dateKeys.length === 0) return { clinicWideKeys: new Set(), dentistKeys: new Set(), reasons: new Map() };
  const rows = await prisma.blockedDate.findMany({
    where: { date: { in: dateKeys } },
    select: { date: true, dentistId: true, reason: true },
  });
  const clinicWideKeys = new Set<string>();
  const dentistKeys = new Set<string>();
  const reasons = new Map<string, string>();
  for (const r of rows) {
    if (r.dentistId === null) {
      clinicWideKeys.add(r.date);
    } else {
      dentistKeys.add(r.date);
    }
    if (r.reason) reasons.set(r.date, r.reason);
  }
  return { clinicWideKeys, dentistKeys, reasons };
}

async function loadOpenDays(dateKeys: string[]): Promise<Set<string>> {
  const hourRows = await prisma.clinicHours.findMany({ where: { isClosed: false } });
  const openDow = new Set(hourRows.map((h) => h.dayOfWeek));
  return new Set(dateKeys.filter((k) => openDow.has(weekdayOfDateKey(k, site.timeZone))));
}

/**
 * A Monday-start month grid (42 cells covering previous/next month edges).
 * Each cell reports the operating state plus booked counts for the day.
 */
export async function getMonthCalendar(
  user: SessionUser,
  opts: { year: number; month: number; dentistId?: string },
): Promise<DayCell[]> {
  requireStaff(user);
  const { year, month, dentistId } = opts;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const leading = (weekdayOfDateKey(monthStart, site.timeZone) + 6) % 7; // Mon=0
  const gridStart = addDaysToKey(monthStart, -leading);
  const gridEnd = addDaysToKey(gridStart, 41);
  const dateKeys = Array.from({ length: 42 }, (_, i) => addDaysToKey(gridStart, i));
  const todayKey = dayKeyLocal(new Date(), site.timeZone);

  const [blocked, openDays, apptRows, dentistBlockedRows] = await Promise.all([
    loadBlocked(dateKeys),
    loadOpenDays(dateKeys),
    prisma.appointment.findMany({
      where: {
        startsAt: {
          gte: new Date(localMidnightUTC(gridStart, site.timeZone)),
          lt: new Date(localMidnightUTC(addDaysToKey(gridEnd, 1), site.timeZone)),
        },
        ...(dentistId ? { dentistId } : {}),
      },
      select: { startsAt: true, status: true },
    }),
    dentistId
      ? prisma.blockedDate.findMany({
          where: { date: { in: dateKeys }, dentistId },
          select: { date: true },
        })
      : Promise.resolve([]),
  ]);

  const apptsByDay = new Map<string, string[]>();
  for (const a of apptRows) {
    const key = dayKeyLocal(a.startsAt, site.timeZone);
    const list = apptsByDay.get(key) ?? [];
    list.push(a.status);
    apptsByDay.set(key, list);
  }

  const dentistBlockedSet = new Set(dentistBlockedRows.map((r) => r.date));

  return dateKeys.map((dateKey) => {
    const statuses = apptsByDay.get(dateKey) ?? [];
    const counts = statuses.reduce<DayCounts>(
      (acc, s) => {
        if ((ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(s)) acc.active += 1;
        else if (s === "COMPLETED") acc.completed += 1;
        else if (s === "CANCELLED") acc.cancelled += 1;
        else if (s === "NO_SHOW") acc.noShow += 1;
        return acc;
      },
      { active: 0, completed: 0, cancelled: 0, noShow: 0 },
    );
    return {
      dateKey,
      inMonth: dateKey >= monthStart && dateKey <= monthEnd,
      isToday: dateKey === todayKey,
      isOpenDay: openDays.has(dateKey) && !blocked.clinicWideKeys.has(dateKey),
      clinicWideBlocked: blocked.clinicWideKeys.has(dateKey),
      dentistBlocked: dentistId ? dentistBlockedSet.has(dateKey) : blocked.dentistKeys.has(dateKey),
      counts,
      total: statuses.length,
    };
  });
}

/**
 * Appointments for a single clinic-local day, with patient/service/dentist
 * context — the "daily schedule" view.
 */
export async function getDayAppointments(
  user: SessionUser,
  opts: { dateKey: string; dentistId?: string },
) {
  requireStaff(user);
  const { dateKey, dentistId } = opts;
  const from = new Date(localMidnightUTC(dateKey, site.timeZone));
  const to = new Date(from.getTime() + 24 * 3600_000);
  const [appointments, blocked] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startsAt: { gte: from, lt: to },
        ...(dentistId ? { dentistId } : {}),
      },
      orderBy: { startsAt: "asc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true } },
        service: { select: { id: true, name: true } },
        dentist: { select: { id: true, name: true, slug: true } },
      },
    }),
    loadBlocked([dateKey]),
  ]);
  return { appointments, blocked };
}

/**
 * Weekly schedule: appointments across a Monday-start week plus, for each
 * active dentist, which weekdays they are off. The page renders the
 * dentist × day grid from these two pieces.
 */
export async function getWeekCalendar(
  user: SessionUser,
  opts: { startDateKey: string; dentistId?: string },
): Promise<{
  week: string[];
  rows: WeekDentistRow[];
  appointments: Awaited<ReturnType<typeof getDayAppointments>>["appointments"];
}> {
  requireStaff(user);
  const { startDateKey, dentistId } = opts;
  const startDow = weekdayOfDateKey(startDateKey, site.timeZone);
  const monday = addDaysToKey(startDateKey, startDow === 0 ? -6 : 1 - startDow);
  const week = Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i));
  const weekEnd = addDaysToKey(monday, 7);

  const [appointments, dentists] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startsAt: {
          gte: new Date(localMidnightUTC(monday, site.timeZone)),
          lt: new Date(localMidnightUTC(weekEnd, site.timeZone)),
        },
        ...(dentistId ? { dentistId } : {}),
      },
      orderBy: { startsAt: "asc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true } },
        service: { select: { id: true, name: true } },
        dentist: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.dentist.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        schedules: {
          where: { isClosed: false },
          select: { dayOfWeek: true, startMinutes: true, endMinutes: true },
        },
      },
    }),
  ]);

  const rows: WeekDentistRow[] = dentists.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    workingDays: d.schedules.map((s) => s.dayOfWeek),
  }));

  return { week, rows, appointments };
}

export { DAY_LABELS };