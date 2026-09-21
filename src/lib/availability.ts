import { cache } from "react";
import { prisma } from "./prisma";
import { site } from "./site";
import { ACTIVE_APPOINTMENT_STATUSES } from "./constants";
import {
  dayKeyFromNow,
  dayKeyLocal,
  localTimeToUTC,
  weekdayOfDateKey,
} from "./datetime";
import { getCachedClinicHours } from "./cache";

export type BookableSlot = {
  start: Date;
  end: Date;
  dateKey: string;
};

export type SlotWithDentist = BookableSlot & {
  dentist: { id: string; name: string; slug: string };
};

export type ClinicHoursRow = {
  dayOfWeek: number;
  openMinutes: number;
  closeMinutes: number;
  isClosed: boolean;
};

export type PresentableHours = {
  dayOfWeek: number;
  dayLabel: string;
  open: string | null; // "08:00" or null when closed
  close: string | null;
  isClosed: boolean;
};

/** Clinic-wide opening hours from the DB, ordered Sunday→Saturday. */
export async function getClinicHours(): Promise<ClinicHoursRow[]> {
  const rows = await prisma.clinicHours.findMany({
    orderBy: { dayOfWeek: "asc" },
  });
  return rows.map(({ dayOfWeek, openMinutes, closeMinutes, isClosed }) => ({
    dayOfWeek,
    openMinutes,
    closeMinutes,
    isClosed,
  }));
}

/**
 * Opening hours formatted for display (e.g. contact + footer sections).
 * Memoised per request so the layout, footer and page share one DB read.
 * The underlying read is Next-data-cached (revalidate: 60s) so the query
 * itself does not hit the DB on every request.
 */
export const getPresentableHours = cache(
  async (): Promise<PresentableHours[]> => getCachedClinicHours(),
);

/** Re-exported for callers that want the shared (React-cached) variant. */
export const getSharedPresentableHours = getPresentableHours;

type DentistForSlots = {
  id: string;
  name: string;
  slug: string;
  schedules: { dayOfWeek: number; startMinutes: number; endMinutes: number }[];
};

type SlotContext = {
  timeZone: string;
  duration: number;
  clinicByDow: Map<number, { startMinutes: number; endMinutes: number }>;
  dentists: DentistForSlots[];
  blockedClinicDates: Set<string>;
  blockedDentistKeys: Set<string>;
  appointments: { startsAt: Date; endsAt: Date; dentistId: string | null }[];
};

function computeSlotsForDay(
  dateKey: string,
  ctx: SlotContext,
): SlotWithDentist[] {
  if (ctx.blockedClinicDates.has(dateKey)) return [];

  const dayOfWeek = weekdayOfDateKey(dateKey, ctx.timeZone);
  const clinicWindow = ctx.clinicByDow.get(dayOfWeek);
  if (!clinicWindow) return [];

  const stepMinutes = Math.min(30, Math.max(15, Math.round(ctx.duration / 3)));
  const dayStartMs = localTimeToUTC(dateKey, 0, ctx.timeZone).getTime();
  const dayEndMs = localTimeToUTC(dateKey, 24 * 60, ctx.timeZone).getTime();

  const clashesByDentist = new Map<string, Array<{ start: number; end: number }>>();
  for (const a of ctx.appointments) {
    if (!a.dentistId) continue;
    const start = a.startsAt.getTime();
    const end = a.endsAt.getTime();
    if (end <= dayStartMs || start >= dayEndMs) continue;
    const list = clashesByDentist.get(a.dentistId) ?? [];
    list.push({ start, end });
    clashesByDentist.set(a.dentistId, list);
  }

  const slots: SlotWithDentist[] = [];

  for (const dentist of ctx.dentists) {
    if (ctx.blockedDentistKeys.has(`${dateKey}:${dentist.id}`)) continue;

    const daySchedules = dentist.schedules.filter(
      (s) => s.dayOfWeek === dayOfWeek,
    );
    if (daySchedules.length === 0) continue;

    let startMinutes = clinicWindow.startMinutes;
    let endMinutes = clinicWindow.endMinutes;
    for (const s of daySchedules) {
      startMinutes = Math.max(clinicWindow.startMinutes, s.startMinutes);
      endMinutes = Math.min(clinicWindow.endMinutes, s.endMinutes);
    }

    const rawStart = localTimeToUTC(dateKey, startMinutes, ctx.timeZone).getTime();
    const rawEnd = localTimeToUTC(dateKey, endMinutes, ctx.timeZone).getTime();
    if (rawEnd - rawStart < ctx.duration * 60_000) continue;

    const clashes = clashesByDentist.get(dentist.id) ?? [];
    const windowEndForSlots = rawEnd - ctx.duration * 60_000;
    for (let t = rawStart; t <= windowEndForSlots; t += stepMinutes * 60_000) {
      const slotEnd = t + ctx.duration * 60_000;
      if (clashes.some((c) => t < c.end && slotEnd > c.start)) continue;
      slots.push({
        start: new Date(t),
        end: new Date(slotEnd),
        dateKey,
        dentist: { id: dentist.id, name: dentist.name, slug: dentist.slug },
      });
    }
  }

  return slots;
}

async function loadSlotContext(opts: {
  serviceId?: string;
  timeZone: string;
  dateKeys: string[];
  duration?: number;
}): Promise<SlotContext> {
  const { serviceId, timeZone, dateKeys, duration = 60 } = opts;
  const context: SlotContext = {
    timeZone,
    duration,
    clinicByDow: new Map(),
    dentists: [],
    blockedClinicDates: new Set(),
    blockedDentistKeys: new Set(),
    appointments: [],
  };
  if (dateKeys.length === 0) return context;

  const first = dateKeys[0];
  const last = dateKeys[dateKeys.length - 1];
  const rangeStart = localTimeToUTC(first, 0, timeZone);
  const rangeEnd = localTimeToUTC(last, 24 * 60, timeZone);

  const [clinicRows, dentists, blocked, appointments] = await Promise.all([
    prisma.clinicHours.findMany({
      where: { isClosed: false },
      select: { dayOfWeek: true, openMinutes: true, closeMinutes: true },
    }),
    prisma.dentist.findMany({
      where: {
        isActive: true,
        ...(serviceId ? { services: { some: { id: serviceId } } } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        schedules: {
          where: { isClosed: false },
          select: { dayOfWeek: true, startMinutes: true, endMinutes: true },
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.blockedDate.findMany({
      where: { date: { gte: first, lte: last } },
      select: { date: true, dentistId: true },
    }),
    prisma.appointment.findMany({
      where: {
        startsAt: { gte: rangeStart, lt: rangeEnd },
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      },
      select: { startsAt: true, endsAt: true, dentistId: true },
    }),
  ]);

  for (const row of clinicRows) {
    context.clinicByDow.set(row.dayOfWeek, {
      startMinutes: row.openMinutes,
      endMinutes: row.closeMinutes,
    });
  }
  context.dentists = dentists;
  for (const b of blocked) {
    if (b.dentistId) context.blockedDentistKeys.add(`${b.date}:${b.dentistId}`);
    else context.blockedClinicDates.add(b.date);
  }
  context.appointments = appointments;
  return context;
}

/**
 * All bookable slots for one local clinic day.
 * Availability is derived at query time from:
 *   − clinic opening hours
 *   − per-dentist weekly schedules (intersect with clinic hours)
 *   − blocked dates (clinic-wide and dentist-specific)
 *   − existing active appointments (double-booking prevention)
 * and returned per dentist. A dentist is included only if they actually offer
 * the service, can cover its duration, and have free capacity that day.
 */
export async function getBookableSlotsForDay(
  dateKey: string,
  options: {
    durationMinutes?: number;
    serviceId?: string;
    timeZone?: string;
  } = {},
): Promise<SlotWithDentist[]> {
  const timeZone = options.timeZone ?? site.timeZone;
  const context = await loadSlotContext({
    serviceId: options.serviceId,
    timeZone,
    dateKeys: [dateKey],
    duration: options.durationMinutes ?? 60,
  });
  return computeSlotsForDay(dateKey, context);
}

/**
 * The next `limit` bookable slots across the next `days` days (clinic time),
 * used for the public availability preview and Phase 2 booking wizard.
 */
export async function getNextAvailableSlots(
  options: {
    days?: number;
    limit?: number;
    durationMinutes?: number;
    serviceId?: string;
    timeZone?: string;
  } = {},
): Promise<SlotWithDentist[]> {
  const timeZone = options.timeZone ?? site.timeZone;
  const days = options.days ?? 14;
  const limit = options.limit ?? 10;
  const dateKeys = Array.from({ length: days }, (_, i) =>
    dayKeyFromNow(i, timeZone),
  );

  const context = await loadSlotContext({
    serviceId: options.serviceId,
    timeZone,
    dateKeys,
    duration: options.durationMinutes ?? 60,
  });

  const out: SlotWithDentist[] = [];
  for (const dateKey of dateKeys) {
    for (const slot of computeSlotsForDay(dateKey, context)) {
      if (out.length >= limit) return out;
      out.push(slot);
    }
  }
  return out;
}

/** Today's clinic date key (for "booked today" labels and future-window checks). */
export function todayKey(timeZone: string = site.timeZone): string {
  return dayKeyLocal(new Date(), timeZone);
}

export type SlotCheck =
  | { ok: true; slot: SlotWithDentist }
  | { ok: false; reason: string };

/**
 * Verify that an exact appointment window (a specific dentist + start/end) is
 * still bookable using the same engine that renders the public calendar. Used
 * at the server boundary before persisting an appointment — the double-booking
 * protection of the public listing is enforced here too.
 */
export async function checkSlot(input: {
  dentistId?: string;
  startsAt: Date;
  endsAt: Date;
  serviceId?: string;
  durationMinutes?: number;
  timeZone?: string;
}): Promise<SlotCheck> {
  const timeZone = input.timeZone ?? site.timeZone;
  const dateKey = dayKeyLocal(input.startsAt, timeZone);
  const slots = await getBookableSlotsForDay(dateKey, {
    durationMinutes: input.durationMinutes,
    serviceId: input.serviceId,
    timeZone,
  });

  const exact = slots.find(
    (s) =>
      s.start.getTime() === input.startsAt.getTime() &&
      s.end.getTime() === input.endsAt.getTime() &&
      (!input.dentistId || s.dentist.id === input.dentistId),
  );

  if (!exact) {
    return {
      ok: false,
      reason: input.dentistId
        ? "This slot is no longer available — choose another time or dentist."
        : "No bookable slot exists for that time.",
    };
  }
  return { ok: true, slot: exact };
}