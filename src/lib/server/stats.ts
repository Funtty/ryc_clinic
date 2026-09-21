import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "./guards";
import type { SessionUser } from "./session";
import { site } from "@/lib/site";
import {
  dayKeyFromNow,
  localMidnightUTC,
} from "@/lib/datetime";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/constants";

/**
 * Admin overview for the dashboard. Every metric below is derived directly
 * from stored appointments and carries an explicit, documented definition so
 * the numbers shown never rely on a guess:
 *
 *  - `todayActive`   appointments starting today that are still live
 *                    (PENDING / CONFIRMED / RESCHEDULED)
 *  - `todayBooked`   every appointment starting today, whatever its status
 *  - `pendingCount`  future PENDING appointments awaiting confirmation
 *  - `next7Days`     future appointments with a live status starting within the
 *                    next 7 days (clinic time)
 *  - cohort (30d):   appointments scheduled to start between the clinic-local
 *                    midnight 29 days ago and "now" — an outcome snapshot of
 *                    the last 30 calendar days. Rates are only compared
 *                    against this cohort, never against all-time totals.
 *    . total          cohort size
 *    . completed      cohort ended COMPLETED
 *    . cancelled      cohort ended CANCELLED
 *    . noShow         cohort ended NO_SHOW
 *    . noShowRate     noShow ÷ (completed + noShow) × 100 — the share of visits
 *                     that were actually faced (completed or missed) but never
 *                     attended. Cancellations are excluded from this denominator
 *                     because they never reached the chair.
 *    . cancellationRate  cancelled ÷ total × 100 — the share of the cohort that
 *                        was cancelled before/at the visit.
 */
export async function getAdminOverview(user: SessionUser) {
  requireStaff(user);

  const timeZone = site.timeZone;
  const todayKey = dayKeyFromNow(0, timeZone);
  const now = new Date();
  const todayStart = new Date(localMidnightUTC(todayKey, timeZone));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600_000);

  // Cohort window: starts at clinic-local midnight 29 days ago → includes a
  // full 30 calendar days up to today.
  const windowStart = new Date(localMidnightUTC(dayKeyFromNow(-29, timeZone), timeZone));

  const [
    todayRows,
    upcoming,
    cohortGrouped,
    pendingCount,
    patientsTotal,
    servicesActive,
    dentistsActive,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { startsAt: { gte: todayStart, lt: tomorrowStart } },
      orderBy: { startsAt: "asc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true } },
        service: { select: { name: true } },
        dentist: { select: { name: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { startsAt: { gte: now }, status: { in: ACTIVE_APPOINTMENT_STATUSES } },
      orderBy: { startsAt: "asc" },
      take: 8,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true } },
        service: { select: { name: true } },
        dentist: { select: { name: true } },
      },
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { startsAt: { gte: windowStart, lt: now } },
      _count: { _all: true },
    }),
    prisma.appointment.count({
      where: { status: "PENDING", startsAt: { gte: now } },
    }),
    prisma.patient.count(),
    prisma.service.count({ where: { isActive: true } }),
    prisma.dentist.count({ where: { isActive: true } }),
  ]);

  const tally: Record<string, number> = {};
  for (const g of cohortGrouped) tally[g.status] = g._count._all;
  const cohortTotal = cohortGrouped.reduce((n, g) => n + g._count._all, 0);
  const completed = tally.COMPLETED ?? 0;
  const noShow = tally.NO_SHOW ?? 0;
  const cancelled = tally.CANCELLED ?? 0;
  const faced = completed + noShow;

  const next7 = await prisma.appointment.count({
    where: {
      startsAt: {
        gte: now,
        lt: new Date(todayStart.getTime() + 7 * 24 * 3600_000),
      },
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES, "COMPLETED"] },
    },
  });

  const todayActive = todayRows.filter((a) =>
    [...ACTIVE_APPOINTMENT_STATUSES].includes(a.status as never),
  ).length;

  return {
    counts: {
      todayActive,
      todayBooked: todayRows.length,
      pendingCount,
      next7Days: next7,
      patientsTotal,
      servicesActive,
      dentistsActive,
    },
    cohort: {
      windowDays: 30,
      total: cohortTotal,
      completed,
      cancelled,
      noShow,
      noShowRate: faced > 0 ? Math.round((noShow / faced) * 100) : 0,
      cancellationRate: cohortTotal > 0 ? Math.round((cancelled / cohortTotal) * 100) : 0,
    },
    today: todayRows,
    upcoming,
    todayKey,
  };
}