import "server-only";
import { prisma } from "@/lib/prisma";
import { errors, toAppError } from "./errors";
import { requireStaff, requireAdmin } from "./guards";
import { hashPassword } from "./password";
import { recordAudit } from "./audit";
import type { SessionUser } from "./session";
import {
  auditLogQuerySchema,
  clinicHoursSchema,
  createBlockedDateSchema,
  createStaffSchema,
  dentistScheduleSchema,
  updateStaffUserSchema,
} from "./validators";

/* ─── Staff user accounts (ADMIN) ─────────────────────────────────────────── */

export async function listStaffUsers(user: SessionUser) {
  requireAdmin(user);
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}

export async function createStaffUser(user: SessionUser, raw: unknown) {
  requireAdmin(user);
  const parsed = createStaffSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    const created = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    await recordAudit({
      userId: user.id,
      action: "user.create",
      entityType: "user",
      entityId: created.id,
      meta: { email: created.email, role: created.role },
    });
    return created;
  } catch (e) {
    const mapped = toAppError(e);
    if (mapped.code === "DUPLICATE_RECORD") {
      throw errors.conflict("A user with this email already exists.");
    }
    throw mapped;
  }
}

/** Admin: reset a user's password and/or activate/deactivate the account. */
export async function updateStaffUser(
  user: SessionUser,
  id: string,
  raw: unknown,
) {
  requireAdmin(user);
  const parsed = updateStaffUserSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());

  const data: { passwordHash?: string; isActive?: boolean } = {};
  if (parsed.data.password !== undefined) {
    data.passwordHash = await hashPassword(parsed.data.password);
  }
  if (parsed.data.isActive !== undefined) {
    data.isActive = parsed.data.isActive;
  }

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });
  } catch (e) {
    throw toAppError(e);
  }

  await recordAudit({
    userId: user.id,
    action: "user.update",
    entityType: "user",
    entityId: id,
    meta: {
      email: updated.email,
      passwordChanged: parsed.data.password !== undefined,
      activeChanged: parsed.data.isActive !== undefined,
      isActive: updated.isActive,
    },
  });
  return updated;
}

/** Admin: paginated audit trail filtered by action/entity/date window. */
export async function listAuditLogs(user: SessionUser, raw: unknown) {
  requireAdmin(user);
  const parsed = auditLogQuerySchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());
  const { action, entityType, from, to, limit } = parsed.data;

  const where = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(from || to ? { createdAt: { gte: from, lte: to } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total };
}

/* ─── Clinic hours (ADMIN) ─────────────────────────────────────────────────── */

export async function getClinicHoursAdmin() {
  return prisma.clinicHours.findMany({ orderBy: { dayOfWeek: "asc" } });
}

export async function updateClinicHours(user: SessionUser, raw: unknown) {
  requireAdmin(user);
  const parsed = clinicHoursSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());

  await prisma.$transaction([
    prisma.clinicHours.deleteMany(),
    prisma.clinicHours.createMany({ data: parsed.data }),
  ]);

  await recordAudit({
    userId: user.id,
    action: "clinic_hours.update",
    entityType: "clinic_hours",
    entityId: "all",
    meta: { days: parsed.data.length },
  });
  return getClinicHoursAdmin();
}

/* ─── Dentist schedules (ADMIN) ───────────────────────────────────────────── */

export async function getSchedules(user: SessionUser, dentistId?: string) {
  requireStaff(user);
  return prisma.dentistSchedule.findMany({
    where: dentistId ? { dentistId } : undefined,
    orderBy: [{ dentistId: "asc" }, { dayOfWeek: "asc" }],
    include: { dentist: { select: { id: true, name: true, slug: true } } },
  });
}

export async function upsertSchedule(user: SessionUser, raw: unknown) {
  requireAdmin(user);
  const parsed = dentistScheduleSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());

  const dentist = await prisma.dentist.findUnique({
    where: { id: parsed.data.dentistId },
  });
  if (!dentist) throw errors.notFound("Dentist");

  const { dentistId, dayOfWeek, ...rest } = parsed.data;
  try {
    const schedule = await prisma.dentistSchedule.upsert({
      where: { dentistId_dayOfWeek: { dentistId, dayOfWeek } },
      update: { ...rest },
      create: { dentistId, dayOfWeek, ...rest },
    });
    await recordAudit({
      userId: user.id,
      action: "schedule.upsert",
      entityType: "dentist_schedule",
      entityId: schedule.id,
      meta: { dentistId, dayOfWeek, ...rest },
    });
    return schedule;
  } catch (e) {
    throw toAppError(e);
  }
}

export async function deleteSchedule(user: SessionUser, id: string) {
  requireAdmin(user);
  await prisma.dentistSchedule.delete({ where: { id } }).catch(() => {
    throw errors.notFound("Schedule");
  });
  await recordAudit({
    userId: user.id,
    action: "schedule.delete",
    entityType: "dentist_schedule",
    entityId: id,
  });
}

/* ─── Blocked dates (ADMIN) ────────────────────────────────────────────────── */

export async function listBlockedDates(user: SessionUser, date?: string) {
  requireStaff(user);
  return prisma.blockedDate.findMany({
    where: date ? { date } : undefined,
    orderBy: { date: "asc" },
    include: { dentist: { select: { id: true, name: true, slug: true } } },
  });
}

export async function createBlockedDate(user: SessionUser, raw: unknown) {
  requireAdmin(user);
  const parsed = createBlockedDateSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());

  if (parsed.data.dentistId) {
    const dentist = await prisma.dentist.findUnique({
      where: { id: parsed.data.dentistId },
    });
    if (!dentist) throw errors.notFound("Dentist");
  }

  // Reject duplicates at the service boundary. The @@unique([date, dentistId])
  // index does not cover a clinic-wide block (dentistId = null) because SQLite
  // treats NULLs as distinct in unique indexes — so an explicit check is needed.
  const existing = await prisma.blockedDate.findFirst({
    where: {
      date: parsed.data.date,
      ...(parsed.data.dentistId
        ? { dentistId: parsed.data.dentistId }
        : { dentistId: null }),
    },
    select: { id: true },
  });
  if (existing) {
    throw errors.conflict("That date is already blocked for this dentist.");
  }

  try {
    const blocked = await prisma.blockedDate.create({ data: parsed.data });
    await recordAudit({
      userId: user.id,
      action: "blocked_date.create",
      entityType: "blocked_date",
      entityId: blocked.id,
      meta: { date: blocked.date, dentistId: blocked.dentistId ?? null },
    });
    return blocked;
  } catch (e) {
    const mapped = toAppError(e);
    if (mapped.code === "DUPLICATE_RECORD") {
      throw errors.conflict("That date is already blocked for this dentist.");
    }
    throw mapped;
  }
}

export async function deleteBlockedDate(user: SessionUser, id: string) {
  requireAdmin(user);
  await prisma.blockedDate.delete({ where: { id } }).catch(() => {
    throw errors.notFound("Blocked date");
  });
  await recordAudit({
    userId: user.id,
    action: "blocked_date.delete",
    entityType: "blocked_date",
    entityId: id,
  });
}