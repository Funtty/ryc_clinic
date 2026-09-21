import "server-only";
import { prisma } from "@/lib/prisma";
import { errors, toAppError } from "./errors";
import { requireStaff } from "./guards";
import { recordAudit } from "./audit";
import type { SessionUser } from "./session";
import { createPatientSchema, updatePatientSchema } from "./validators";

export async function listPatients(user: SessionUser, q?: string) {
  requireStaff(user);
  const term = q?.trim();
  return prisma.patient.findMany({
    where: term
      ? {
          OR: [
            { firstName: { contains: term } },
            { lastName: { contains: term } },
            { email: { contains: term } },
            { phone: { contains: term } },
          ],
        }
      : undefined,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    // Minimal PHI for the list view: identity + contact + visit count only.
    // notes and dateOfBirth are sensitive and reserved for the detail view.
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      createdAt: true,
      _count: { select: { appointments: true } },
    },
  });
}

export async function getPatient(user: SessionUser, id: string) {
  requireStaff(user);
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) throw errors.notFound("Patient");
  return patient;
}

export async function createPatient(user: SessionUser, raw: unknown) {
  requireStaff(user);
  const parsed = createPatientSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());

  try {
    const patient = await prisma.patient.create({ data: parsed.data });
    await recordAudit({
      userId: user.id,
      action: "patient.create",
      entityType: "patient",
      entityId: patient.id,
      meta: { email: patient.email },
    });
    return patient;
  } catch (e) {
    const mapped = toAppError(e);
    if (mapped.code === "DUPLICATE_RECORD") {
      throw errors.conflict("A patient with this email already exists.");
    }
    throw mapped;
  }
}

export async function updatePatient(user: SessionUser, id: string, raw: unknown) {
  requireStaff(user);
  const parsed = updatePatientSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());

  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing) throw errors.notFound("Patient");

  try {
    const patient = await prisma.patient.update({ where: { id }, data: parsed.data });
    await recordAudit({
      userId: user.id,
      action: "patient.update",
      entityType: "patient",
      entityId: id,
      meta: { fields: Object.keys(parsed.data) },
    });
    return patient;
  } catch (e) {
    const mapped = toAppError(e);
    if (mapped.code === "DUPLICATE_RECORD") {
      throw errors.conflict("A patient with this email already exists.");
    }
    throw mapped;
  }
}