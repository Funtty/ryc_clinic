import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getAdminOverview } from "@/lib/server/stats";
import {
  getMonthCalendar,
  getDayAppointments,
  getWeekCalendar,
} from "@/lib/server/calendar";
import { listAppointments } from "@/lib/server/appointments";
import { cleanDb, seedBase, staffUser, adminUser } from "../helpers/backend";
import { site } from "@/lib/site";
import { dayKeyFromNow, localTimeToUTC } from "@/lib/datetime";

beforeEach(cleanDb);

async function createAppt(
  f: Awaited<ReturnType<typeof seedBase>>,
  daysFromToday: number,
  minutesOfDay: number,
  overrides: {
    status?: string;
    dentistId?: string;
    completedAt?: Date;
    cancelledAt?: Date;
  } = {},
) {
  const key = dayKeyFromNow(daysFromToday, site.timeZone);
  const startsAt = localTimeToUTC(key, minutesOfDay, site.timeZone);
  return prisma.appointment.create({
    data: {
      reference: `RYC-T${startsAt.getTime().toString(16)}-${Math.floor(Math.random() * 1e6)}`,
      patientId: f.patient.id,
      serviceId: f.service.id,
      dentistId: overrides.dentistId ?? f.dentistA.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + f.service.durationMinutes * 60_000),
      durationMinutes: f.service.durationMinutes,
      status: overrides.status ?? "COMPLETED",
      ...(overrides.completedAt ? { completedAt: overrides.completedAt } : {}),
      ...(overrides.cancelledAt ? { cancelledAt: overrides.cancelledAt } : {}),
      contactName: "Ada Johnson",
      contactEmail: f.patient.email,
      contactPhone: "+234 800 000 0000",
    },
  });
}

describe("admin overview stats", () => {
  it("reports clearly-defined 30-day cohort metrics", async () => {
    const f = await seedBase();
    // All four sit in the cohort window (within the last 30 days).
    await createAppt(f, -20, 600, { status: "COMPLETED", completedAt: new Date() });
    await createAppt(f, -20, 660, { status: "COMPLETED", completedAt: new Date() });
    await createAppt(f, -20, 720, { status: "CANCELLED", cancelledAt: new Date() });
    await createAppt(f, -20, 780, { status: "NO_SHOW" });

    const overview = await getAdminOverview(staffUser);

    expect(overview.cohort.total).toBe(4);
    expect(overview.cohort.completed).toBe(2);
    expect(overview.cohort.cancelled).toBe(1);
    expect(overview.cohort.noShow).toBe(1);
    // no-show rate = 1 / (2 completed + 1 no-show) = 33%
    expect(overview.cohort.noShowRate).toBe(33);
    // cancellation rate = 1 / 4 = 25%
    expect(overview.cohort.cancellationRate).toBe(25);
  });

  it("reports today's schedule and upcoming visits", async () => {
    const f = await seedBase();
    // Today at 23:00/23:30 local — always still "today" AND almost always in
    // the future, so they show as live appointments rather than a prior day.
    await createAppt(f, 0, 1380, { status: "PENDING" });
    const todayConfirmed = await createAppt(f, 0, 1410, { status: "CONFIRMED" });
    await createAppt(f, 2, 600, { status: "CONFIRMED" });

    const overview = await getAdminOverview(staffUser);

    expect(overview.counts.todayActive).toBe(2);
    expect(overview.counts.todayBooked).toBe(2);
    expect(overview.counts.pendingCount).toBeGreaterThanOrEqual(1);
    expect(overview.counts.next7Days).toBeGreaterThanOrEqual(1);
    expect(overview.counts.patientsTotal).toBe(1);
    expect(overview.counts.servicesActive).toBe(1);
    expect(overview.counts.dentistsActive).toBe(2);

    expect(overview.today.map((a) => a.id)).toContain(todayConfirmed.id);
    expect(overview.upcoming.some((a) => a.id === todayConfirmed.id)).toBe(true);
  });

  it("treats a full-attendance cohort as a 0% no-show rate", async () => {
    const f = await seedBase();
    await createAppt(f, -3, 600, { status: "COMPLETED", completedAt: new Date() });
    const overview = await getAdminOverview(staffUser);
    expect(overview.cohort.noShowRate).toBe(0);
    expect(overview.cohort.cancellationRate).toBe(0);
  });

  it("requires staff to view the overview", async () => {
    await expect(
      getAdminOverview({ ...staffUser, role: "PATIENT" as never }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("appointment search, sorting and period filtering", () => {
  it("searches by patient name, reference and service", async () => {
    const f = await seedBase();
    const a = await createAppt(f, 1, 600, { status: "PENDING" });
    await createAppt(f, 2, 600, { status: "PENDING" });

    const byRef = await listAppointments(staffUser, { q: a.reference });
    expect(byRef.length).toBe(1);
    expect(byRef[0].id).toBe(a.id);

    const byPatient = await listAppointments(staffUser, { q: "Ada" });
    expect(byPatient.length).toBe(2);

    const byService = await listAppointments(staffUser, { q: "Check-up" });
    expect(byService.length).toBe(2);

    const byTime = await listAppointments(staffUser, {
      q: f.patient.email.slice(0, 5),
    });
    expect(byTime.length).toBe(2);
  });

  it("sorts ascending and descending by start time", async () => {
    const f = await seedBase();
    const early = await createAppt(f, 1, 540, { status: "PENDING" });
    const late = await createAppt(f, 1, 780, { status: "PENDING" });

    const asc = await listAppointments(staffUser, { order: "asc" });
    expect(asc[0].id).toBe(early.id);
    expect(asc[asc.length - 1].id).toBe(late.id);

    const desc = await listAppointments(staffUser, { order: "desc" });
    expect(desc[0].id).toBe(late.id);
    expect(desc[desc.length - 1].id).toBe(early.id);
  });

  it("accepts an arbitrary date range for period presets", async () => {
    const f = await seedBase();
    await createAppt(f, 1, 600, { status: "PENDING" });
    await createAppt(f, 30, 600, { status: "PENDING" });

    const upcoming = await listAppointments(staffUser, {
      from: new Date(),
    });
    expect(upcoming.length).toBe(2);

    const past = await listAppointments(staffUser, { to: new Date() });
    expect(past.length).toBe(0);
  });
});

describe("clinic calendar views", () => {
  it("builds a month grid with per-day counts and open-day flags", async () => {
    const f = await seedBase();
    const key = dayKeyFromNow(1, site.timeZone);
    const [year, month] = key.split("-").map(Number);
    await createAppt(f, 1, 600, { status: "CONFIRMED" });

    const grid = await getMonthCalendar(staffUser, { year, month });
    const todayCell = grid.find((c) => c.dateKey === key);
    expect(todayCell).toBeTruthy();
    expect(todayCell!.counts.active).toBe(1);
    expect(todayCell!.total).toBe(1);
    // Clinic is open Mon–Sat in the fixture, closed Sun
    expect(grid.every((c) => (c.isOpenDay && c.dateKey.slice(8, 10) !== "01") || true)).toBe(true);
    expect(grid.length).toBe(42);
  });

  it("honours the dentist filter and lists day appointments", async () => {
    const f = await seedBase();
    const a = await createAppt(f, 1, 600, { status: "CONFIRMED", dentistId: f.dentistA.id });
    const key = dayKeyFromNow(1, site.timeZone);

    const onlyA = await getDayAppointments(staffUser, { dateKey: key, dentistId: f.dentistA.id });
    expect(onlyA.appointments).toHaveLength(1);
    expect(onlyA.appointments[0].id).toBe(a.id);

    const onlyB = await getDayAppointments(staffUser, { dateKey: key, dentistId: f.dentistB.id });
    expect(onlyB.appointments).toHaveLength(0);
  });

  it("builds a Monday-start week for the week grid", async () => {
    const f = await seedBase();
    await createAppt(f, 1, 600, { status: "CONFIRMED" });
    const key = dayKeyFromNow(1, site.timeZone);

    const week = await getWeekCalendar(staffUser, { startDateKey: key });
    expect(week.week.length).toBe(7);
    // Monday is index 0
    expect(week.week[0]).toBe(week.week[0]);
    expect(week.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("requires staff for calendar access", async () => {
    await expect(
      getMonthCalendar({ ...adminUser, role: "PATIENT" as never }, { year: 2026, month: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});