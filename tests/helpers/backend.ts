import { prisma } from "@/lib/prisma";
import { site } from "@/lib/site";
import { localTimeToUTC, dayKeyFromNow, weekdayOfDateKey } from "@/lib/datetime";
import type { SessionUser } from "@/lib/server/session";

/** Staff views used by service functions in tests. */
export const staffUser: SessionUser = {
  id: "staff-user-id",
  email: "staff@ryc.example",
  name: "Staff Tester",
  role: "STAFF",
  isActive: true,
};

export const adminUser: SessionUser = {
  id: "admin-user-id",
  email: "admin@ryc.example",
  name: "Admin Tester",
  role: "ADMIN",
  isActive: true,
};

/** Wipe every row, FK-safe, so each test starts from a known state. */
export async function cleanDb(): Promise<void> {
  await prisma.session.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.blockedDate.deleteMany();
  await prisma.dentistSchedule.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.dentist.deleteMany();
  await prisma.service.deleteMany();
  await prisma.clinicHours.deleteMany();
  await prisma.user.deleteMany();
}

export type Fixture = {
  admin: SessionUser;
  dentistA: { id: string; name: string; slug: string };
  dentistB: { id: string; name: string; slug: string };
  service: { id: string; name: string; durationMinutes: number; price: number | null };
  patient: { id: string; email: string };
};

export const DEFAULT_EMAIL = "patient@ryc.example";

const HOURS = [
  { dayOfWeek: 1, openMinutes: 480, closeMinutes: 1020 },
  { dayOfWeek: 2, openMinutes: 480, closeMinutes: 1020 },
  { dayOfWeek: 3, openMinutes: 480, closeMinutes: 1020 },
  { dayOfWeek: 4, openMinutes: 480, closeMinutes: 1020 },
  { dayOfWeek: 5, openMinutes: 480, closeMinutes: 1020 },
  { dayOfWeek: 6, openMinutes: 480, closeMinutes: 1020 },
];

export async function seedBase(email: string = DEFAULT_EMAIL): Promise<Fixture> {
  const admin = await prisma.user.create({
    data: {
      id: adminUser.id,
      email: "admin@ryc.example",
      name: "Admin Tester",
      passwordHash: "x",
      role: "ADMIN",
    },
  });
  const staff = await prisma.user.create({
    data: {
      id: staffUser.id,
      email: "staff@ryc.example",
      name: "Staff Tester",
      passwordHash: "x",
      role: "STAFF",
    },
  });
  void admin;
  void staff;

  await prisma.clinicHours.createMany({ data: HOURS });

  const service = await prisma.service.create({
    data: {
      id: "service-checkup",
      slug: "check-up",
      name: "Check-up & Cleaning",
      shortDescription: "test",
      description: "test",
      durationMinutes: 45,
      price: 30000,
      currency: "NGN",
      sortOrder: 1,
    },
  });

  const dentistA = await prisma.dentist.create({
    data: {
      id: "dentist-a",
      slug: "dentist-a",
      name: "Dr. Test A",
      title: "General Dentist",
      bio: "test",
      sortOrder: 1,
      schedules: {
        create: HOURS.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          startMinutes: 480,
          endMinutes: 1020,
        })),
      },
    },
  });

  const dentistB = await prisma.dentist.create({
    data: {
      id: "dentist-b",
      slug: "dentist-b",
      name: "Dr. Test B",
      title: "General Dentist",
      bio: "test",
      sortOrder: 2,
      schedules: {
        create: HOURS.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          startMinutes: 480,
          endMinutes: 1020,
        })),
      },
    },
  });

  await prisma.service.update({
    where: { id: service.id },
    data: { dentists: { connect: [{ id: dentistA.id }, { id: dentistB.id }] } },
  });

  const patient = await prisma.patient.create({
    data: {
      id: "patient-seed",
      email,
      firstName: "Ada",
      lastName: "Johnson",
      phone: "+234 800 000 0000",
    },
  });

  return {
    admin: adminUser,
    dentistA: { id: dentistA.id, name: dentistA.name, slug: dentistA.slug },
    dentistB: { id: dentistB.id, name: dentistB.name, slug: dentistB.slug },
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      price: service.price,
    },
    patient: { id: patient.id, email: patient.email },
  };
}

/**
 * A future, bookable start time: the first 10:00 slot on a working day that is
 * still ahead of now (clinic timezone). Deterministic and independent of the
 * actual test date.
 */
export async function nextStartAtAt(plan: {
  timeZone?: string;
  minutesOfDay?: number;
} = {}): Promise<Date> {
  const timeZone = plan.timeZone ?? site.timeZone;
  const minutesOfDay = plan.minutesOfDay ?? 600;
  const now = Date.now();

  for (let i = 0; i < 21; i += 1) {
    const dateKey = dayKeyFromNow(i, timeZone);
    const weekday = weekdayOfDateKey(dateKey, timeZone);
    if (weekday === 0 || weekday === 6) continue;
    const candidate = localTimeToUTC(dateKey, minutesOfDay, timeZone);
    if (candidate.getTime() > now + 15 * 60_000) return candidate;
  }
  throw new Error("Could not find a future bookable start time");
}