import "server-only";
import { prisma } from "@/lib/prisma";
import { errors, toAppError } from "./errors";
import { requireAdmin, requireStaff } from "./guards";
import { recordAudit } from "./audit";
import { releaseAssetIfUnused } from "./files";
import type { SessionUser } from "./session";
import { createDentistSchema, updateDentistSchema } from "./validators";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "dentist"
  );
}

/** Staff: list dentists with their schedules (for booking/admin contexts). */
export async function listDentistsAdmin(user: SessionUser) {
  requireStaff(user);
  return prisma.dentist.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      schedules: { orderBy: { dayOfWeek: "asc" } },
      services: { select: { id: true, name: true, slug: true } },
      _count: { select: { appointments: true } },
    },
  });
}

export async function getDentistAdmin(user: SessionUser, id: string) {
  requireStaff(user);
  const dentist = await prisma.dentist.findUnique({
    where: { id },
    include: {
      schedules: { orderBy: { dayOfWeek: "asc" } },
      services: { select: { id: true, name: true, slug: true } },
      _count: { select: { appointments: true } },
    },
  });
  if (!dentist) throw errors.notFound("Dentist");
  return dentist;
}

/** Admin: create a dentist (slug auto-generated when omitted). */
export async function createDentist(user: SessionUser, raw: unknown) {
  requireAdmin(user);
  const parsed = createDentistSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());

  const slug = await uniqueSlug(parsed.data.name);
  try {
    const created = await prisma.dentist.create({
      data: { ...parsed.data, slug },
    });
    await recordAudit({
      userId: user.id,
      action: "dentist.create",
      entityType: "dentist",
      entityId: created.id,
      meta: { name: created.name, slug },
    });
    return created;
  } catch (e) {
    throw toAppError(e);
  }
}

/** Admin: edit a dentist (including enable/disable). */
export async function updateDentist(user: SessionUser, id: string, raw: unknown) {
  requireAdmin(user);
  const parsed = updateDentistSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());
  if (parsed.data.photoUrl === "") parsed.data.photoUrl = null;

  const existing = await prisma.dentist.findUnique({
    where: { id },
    select: { photoUrl: true },
  });
  if (!existing) throw errors.notFound("Dentist");

  try {
    const updated = await prisma.dentist.update({
      where: { id },
      data: parsed.data,
    });
    await recordAudit({
      userId: user.id,
      action: "dentist.update",
      entityType: "dentist",
      entityId: id,
      meta: {
        name: updated.name,
        isActive: updated.isActive,
        changed: Object.keys(parsed.data),
      },
    });
    if (
      parsed.data.photoUrl !== undefined &&
      parsed.data.photoUrl !== existing.photoUrl
    ) {
      await releaseAssetIfUnused(existing.photoUrl);
    }
    return updated;
  } catch (e) {
    const mapped = toAppError(e);
    if (mapped.code === "DUPLICATE_RECORD") {
      throw errors.conflict("Another dentist uses that name.");
    }
    throw mapped;
  }
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await prisma.dentist.findUnique({ where: { slug } })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}