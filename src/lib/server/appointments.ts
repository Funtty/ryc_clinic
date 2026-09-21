import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { site } from "@/lib/site";
import { ACTIVE_APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/constants";
import { checkSlot } from "@/lib/availability";
import { errors, toAppError, AppError } from "./errors";
import { requireStaff } from "./guards";
import { recordAudit } from "./audit";
import { generateReference } from "./reference";
import type { SessionUser } from "./session";
import {
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  rescheduleSchema,
  transitionSchema,
} from "./validators";

/**
 * Legal status transitions. Each map lists the states reachable from a key.
 * All transitions are enforced at the service boundary; the DB itself is
 * status-agnostic so the application is the single source of truth here.
 */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  // PENDING → RESCHEDULED: a deposit-pending booking can move time before it is
  // confirmed (e.g. the patient calls back to change the slot while awaiting
  // payment). Kept alongside the reschedule service path so both routes accept
  // the move.
  PENDING: ["CONFIRMED", "RESCHEDULED", "CANCELLED"],
  CONFIRMED: ["RESCHEDULED", "CANCELLED", "COMPLETED", "NO_SHOW"],
  RESCHEDULED: ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
};

export type AppointmentCreateResult = Awaited<ReturnType<typeof loadAppointment>>;

async function loadAppointment(tx: Prisma.TransactionClient, id: string) {
  return tx.appointment.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      service: { select: { id: true, name: true, durationMinutes: true, price: true } },
      dentist: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function createAppointment(
  user: SessionUser,
  raw: unknown,
): Promise<AppointmentCreateResult> {
  requireStaff(user);

  const input = createAppointmentSchema.safeParse(raw);
  if (!input.success) throw errors.validation(input.error.flatten());

  const { patientId, serviceId, dentistId, startsAt, notes } = input.data;

  const [patient, service, dentist] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId } }),
    prisma.service.findUnique({ where: { id: serviceId } }),
    dentistId ? prisma.dentist.findUnique({ where: { id: dentistId } }) : null,
  ]);
  if (!patient) throw errors.notFound("Patient");
  if (!service || !service.isActive) throw errors.notFound("Service");
  if (dentistId && (!dentist || !dentist.isActive)) throw errors.notFound("Dentist");

  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
  const slot = await checkSlot({
    dentistId,
    startsAt,
    endsAt,
    serviceId,
    durationMinutes: service.durationMinutes,
    timeZone: site.timeZone,
  });
  if (!slot.ok) throw errors.conflict(slot.reason);

  // Serialized transaction: SQLite serializes writes, PostgreSQL would use a
  // serializable transaction here. The conflict re-check + atomic create make
  // double-booking impossible at the database layer too.
  try {
    return await prisma.$transaction(async (tx) => {
      const clash = await tx.appointment.findFirst({
        where: {
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
          ...(dentistId ? { dentistId } : {}),
        },
        select: { id: true },
      });
      if (clash) throw errors.conflict("That time is no longer available.");

      const reference = generateReference();
      const appointment = await tx.appointment.create({
        data: {
          reference,
          patientId,
          serviceId,
          dentistId: dentistId ?? null,
          startsAt,
          endsAt,
          durationMinutes: service.durationMinutes,
          contactName: `${patient.firstName} ${patient.lastName}`.trim(),
          contactEmail: patient.email,
          contactPhone: patient.phone,
          notes,
        },
      });

      await recordAudit(
        {
          userId: user.id,
          action: "appointment.create",
          entityType: "appointment",
          entityId: appointment.id,
          meta: { reference, startsAt, serviceId, dentistId: dentistId ?? null },
        },
        tx,
      );

      return loadAppointment(tx, appointment.id);
    });
  } catch (e) {
    throw mapAppointmentError(e);
  }
}

function mapAppointmentError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const mapped = toAppError(e);
  if (mapped.code === "DUPLICATE_RECORD") {
    return new AppError("REFERENCE_COLLISION", "Could not allocate a unique reference.", 409);
  }
  return mapped;
}

export async function listAppointments(user: SessionUser, rawQuery: unknown) {
  requireStaff(user);
  const query = listAppointmentsQuerySchema.safeParse(rawQuery ?? {});
  if (!query.success) throw errors.validation(query.error.flatten());

  const { status, from, to, dentistId, serviceId, patientId, q, order } = query.data;
  const where = {
    ...(status ? { status } : {}),
    ...(dentistId ? { dentistId } : {}),
    ...(serviceId ? { serviceId } : {}),
    ...(patientId ? { patientId } : {}),
    ...(from || to
      ? {
          startsAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q } },
            { contactName: { contains: q } },
            { contactEmail: { contains: q } },
            { contactPhone: { contains: q } },
            { patient: { firstName: { contains: q } } },
            { patient: { lastName: { contains: q } } },
            { patient: { email: { contains: q } } },
            { patient: { phone: { contains: q } } },
            { service: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  return prisma.appointment.findMany({
    where,
    orderBy: { startsAt: order },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      service: { select: { id: true, name: true } },
      dentist: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function getAppointment(user: SessionUser, id: string) {
  requireStaff(user);
  const appointment = await loadAppointment(prisma, id);
  if (!appointment) throw errors.notFound("Appointment");
  return appointment;
}

type TransitionInput = {
  status: AppointmentStatus;
  cancellationReason?: string;
};

export async function transitionAppointment(
  user: SessionUser,
  id: string,
  raw: unknown,
) {
  requireStaff(user);

  const parsed = transitionSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());
  const { status, cancellationReason } = parsed.data as TransitionInput;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      service: { select: { name: true } },
      dentist: { select: { name: true } },
      patient: { select: { id: true, email: true, firstName: true } },
    },
  });
  if (!appointment) throw errors.notFound("Appointment");

  const allowed = APPOINTMENT_TRANSITIONS[appointment.status as AppointmentStatus];
  if (!allowed.includes(status)) {
    throw errors.conflict(
      `Cannot move an appointment from ${appointment.status} to ${status}.`,
    );
  }
  if (status === "CANCELLED" && !cancellationReason) {
    throw errors.validation({ cancellationReason: ["A cancellation reason is required"] });
  }

  // Conditional update keyed on the status we actually observed (TOCTOU-safe):
  // if two staff race to transition the same row, exactly one wins because the
  // second update matches zero rows and is rejected rather than overwriting.
  const updated = await prisma.appointment.updateMany({
    where: { id, status: appointment.status },
    data: {
      status,
      ...(status === "CANCELLED"
        ? { cancellationReason: cancellationReason ?? "", cancelledAt: new Date() }
        : {}),
      ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });
  if (updated.count === 0) {
    throw errors.conflict(
      "This appointment was just changed by someone else. Refresh and try again.",
    );
  }

  await recordAudit({
    userId: user.id,
    action: `appointment.${status.toLowerCase()}`,
    entityType: "appointment",
    entityId: id,
    meta: { from: appointment.status, to: status, cancellationReason },
  });

  return prisma.appointment.findUniqueOrThrow({ where: { id } });
}

export async function rescheduleAppointment(
  user: SessionUser,
  id: string,
  raw: unknown,
) {
  requireStaff(user);

  const parsed = rescheduleSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());
  const { startsAt } = parsed.data;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { service: true },
  });
  if (!appointment) throw errors.notFound("Appointment");

  const current = appointment.status as AppointmentStatus;
  if (!["PENDING", "CONFIRMED"].includes(current)) {
    throw errors.conflict(`Cannot reschedule an appointment that is ${current}.`);
  }

  const endsAt = new Date(startsAt.getTime() + appointment.service.durationMinutes * 60_000);
  const slot = await checkSlot({
    dentistId: appointment.dentistId ?? undefined,
    startsAt,
    endsAt,
    serviceId: appointment.serviceId,
    durationMinutes: appointment.service.durationMinutes,
    timeZone: site.timeZone,
  });
  if (!slot.ok) throw errors.conflict(slot.reason);

  try {
    return await prisma.$transaction(async (tx) => {
      const clash = await tx.appointment.findFirst({
        where: {
          id: { not: id },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
          ...(appointment.dentistId ? { dentistId: appointment.dentistId } : {}),
        },
        select: { id: true },
      });
      if (clash) throw errors.conflict("That time is no longer available.");

      const updated = await tx.appointment.updateMany({
        where: { id, status: current },
        data: { startsAt, endsAt, status: "RESCHEDULED" },
      });
      if (updated.count === 0) {
        throw errors.conflict(
          "This appointment was just changed by someone else. Refresh and try again.",
        );
      }

      await recordAudit(
        {
          userId: user.id,
          action: "appointment.reschedule",
          entityType: "appointment",
          entityId: id,
          meta: { from: appointment.startsAt, to: startsAt },
        },
        tx,
      );

      return tx.appointment.findUniqueOrThrow({ where: { id } });
    });
  } catch (e) {
    throw mapAppointmentError(e);
  }
}