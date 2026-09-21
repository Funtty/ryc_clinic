import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  listStaffUsers,
  createStaffUser,
  updateClinicHours,
  getClinicHoursAdmin,
  getSchedules,
  upsertSchedule,
  deleteSchedule,
  listBlockedDates,
  createBlockedDate,
  deleteBlockedDate,
} from "@/lib/server/admin";
import { createNotification } from "@/lib/server/notifications";
import {
  cleanDb,
  seedBase,
  staffUser,
  adminUser,
} from "../helpers/backend";

beforeEach(cleanDb);

describe("staff user administration", () => {
  it("is admin-only", async () => {
    await seedBase();
    await expect(listStaffUsers(staffUser)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      createStaffUser(staffUser, {
        name: "X",
        email: "x@ryc.example",
        password: "password123",
        role: "STAFF",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates a staff user with a hashed password and rejects duplicates", async () => {
    await seedBase();
    const created = await createStaffUser(adminUser, {
      name: "Receptionist",
      email: "receptionist@ryc.example",
      password: "long-enough-password",
      role: "STAFF",
    });
    expect(created.email).toBe("receptionist@ryc.example");
    expect(created).not.toHaveProperty("passwordHash");

    const stored = await prisma.user.findUnique({
      where: { email: "receptionist@ryc.example" },
    });
    expect(stored?.passwordHash).toBeTruthy();
    expect(stored?.passwordHash).not.toBe("long-enough-password");

    await expect(
      createStaffUser(adminUser, {
        name: "Receptionist",
        email: "receptionist@ryc.example",
        password: "another-password",
        role: "STAFF",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      createStaffUser(adminUser, {
        name: "X",
        email: "short@x",
        password: "short",
        role: "STAFF",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("clinic hours administration", () => {
  it("replaces the weekly schedule when all 7 days are valid", async () => {
    await seedBase();
    const rows = [
      { dayOfWeek: 1, openMinutes: 540, closeMinutes: 1020 },
      { dayOfWeek: 2, openMinutes: 540, closeMinutes: 1020 },
      { dayOfWeek: 3, openMinutes: 540, closeMinutes: 1020 },
      { dayOfWeek: 4, openMinutes: 540, closeMinutes: 1020 },
      { dayOfWeek: 5, openMinutes: 540, closeMinutes: 1020 },
      { dayOfWeek: 6, openMinutes: 540, closeMinutes: 780 },
      { dayOfWeek: 0, openMinutes: 0, closeMinutes: 0, isClosed: true },
    ];
    await updateClinicHours(adminUser, rows);

    const stored = await getClinicHoursAdmin();
    expect(stored).toHaveLength(7);
    expect(stored.find((r) => r.dayOfWeek === 6)?.openMinutes).toBe(540);

    expect(
      stored.find((r) => r.dayOfWeek === 0)?.isClosed,
    ).toBe(true);
  });

  it("rejects an incomplete week and closing-before-opening", async () => {
    await seedBase();
    const sixRows = [
      { dayOfWeek: 1, openMinutes: 480, closeMinutes: 1020 },
      { dayOfWeek: 2, openMinutes: 480, closeMinutes: 1020 },
      { dayOfWeek: 3, openMinutes: 480, closeMinutes: 1020 },
      { dayOfWeek: 4, openMinutes: 480, closeMinutes: 1020 },
      { dayOfWeek: 5, openMinutes: 480, closeMinutes: 1020 },
      { dayOfWeek: 6, openMinutes: 480, closeMinutes: 1020 },
    ];
    await expect(updateClinicHours(adminUser, sixRows)).rejects.toMatchObject({
      code: "VALIDATION",
    });

    const bad = [...sixRows, { dayOfWeek: 0, openMinutes: 1020, closeMinutes: 480 }];
    await expect(updateClinicHours(adminUser, bad)).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});

describe("dentist schedule administration", () => {
  it("upserts, lists and deletes a dentist's weekly schedule", async () => {
    const f = await seedBase();

    const created = await upsertSchedule(adminUser, {
      dentistId: f.dentistA.id,
      dayOfWeek: 1,
      startMinutes: 480,
      endMinutes: 1020,
    });
    expect(created.dayOfWeek).toBe(1);
    const upserted = await upsertSchedule(adminUser, {
      dentistId: f.dentistA.id,
      dayOfWeek: 1,
      startMinutes: 540,
      endMinutes: 1020,
    });
    expect(upserted.startMinutes).toBe(540);

    const schedules = await getSchedules(staffUser, f.dentistA.id);
    expect(schedules.filter((s) => s.dayOfWeek === 1)).toHaveLength(1);

    await deleteSchedule(adminUser, upserted.id);
    const after = await getSchedules(staffUser, f.dentistA.id);
    expect(after.filter((s) => s.dayOfWeek === 1)).toHaveLength(0);
  });
});

describe("blocked dates", () => {
  it("creates clinic-wide and per-dentist blocks, and prevents duplicates", async () => {
    const f = await seedBase();

    const clinic = await createBlockedDate(adminUser, {
      date: "2026-12-25",
      reason: "Christmas",
    });
    expect(clinic.dentistId).toBeNull();

    const perDentist = await createBlockedDate(adminUser, {
      date: "2026-12-24",
      dentistId: f.dentistA.id,
      reason: "Leave",
    });
    expect(perDentist.dentistId).toBe(f.dentistA.id);

    await expect(
      createBlockedDate(adminUser, { date: "2026-12-24", dentistId: f.dentistA.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const all = await listBlockedDates(staffUser);
    expect(all).toHaveLength(2);

    await deleteBlockedDate(adminUser, clinic.id);
    expect(await listBlockedDates(staffUser)).toHaveLength(1);
  });

  it("validates the date format", async () => {
    await seedBase();
    await expect(
      createBlockedDate(adminUser, { date: "25-12-2026" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("prevents duplicate clinic-wide blocks for the same date", async () => {
    await seedBase();
    await createBlockedDate(adminUser, { date: "2026-12-25", reason: "Christmas" });
    await expect(
      createBlockedDate(adminUser, { date: "2026-12-25", reason: "Boxing day" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("notifications", () => {
  it("queues an in-app notification", async () => {
    const user = await prisma.user.create({
      data: {
        email: "n@ryc.example",
        name: "N",
        passwordHash: "x",
        role: "STAFF",
      },
    });
    await createNotification({
      userId: user.id,
      title: "New appointment",
      body: "You have a booking for Monday 10:00.",
    });
    const rows = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].isRead).toBe(false);
  });
});