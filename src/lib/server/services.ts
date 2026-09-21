import "server-only";
import { prisma } from "@/lib/prisma";
import { errors, toAppError } from "./errors";
import { requireAdmin, requireStaff } from "./guards";
import { recordAudit } from "./audit";
import { releaseAssetIfUnused } from "./files";
import type { SessionUser } from "./session";
import { createServiceSchema, updateServiceSchema } from "./validators";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "service";
}

/** Staff: list services (for booking/admin contexts). */
export async function listServicesAdmin(user: SessionUser) {
  requireStaff(user);
  return prisma.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { bookedFor: true } },
      dentists: { select: { id: true, name: true, slug: true } },
    },
  });
}

/** Admin: create a service (slug auto-generated when omitted). */
export async function createService(user: SessionUser, raw: unknown) {
  requireAdmin(user);
  const parsed = createServiceSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());

  const slug = await uniqueSlug(parsed.data.name);
  try {
    const created = await prisma.service.create({
      data: { ...parsed.data, slug },
    });
    await recordAudit({
      userId: user.id,
      action: "service.create",
      entityType: "service",
      entityId: created.id,
      meta: { name: created.name, slug },
    });
    return created;
  } catch (e) {
    throw toAppError(e);
  }
}

/** Admin: edit a service (including enable/disable). */
export async function updateService(user: SessionUser, id: string, raw: unknown) {
  requireAdmin(user);
  const parsed = updateServiceSchema.safeParse(raw);
  if (!parsed.success) throw errors.validation(parsed.error.flatten());
  if (parsed.data.description === "") parsed.data.description = " ";
  if (parsed.data.imageUrl === "") parsed.data.imageUrl = null;

  const existing = await prisma.service.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  if (!existing) throw errors.notFound("Service");

  try {
    const updated = await prisma.service.update({
      where: { id },
      data: parsed.data,
    });
    await recordAudit({
      userId: user.id,
      action: "service.update",
      entityType: "service",
      entityId: id,
      meta: {
        name: updated.name,
        isActive: updated.isActive,
        changed: Object.keys(parsed.data),
      },
    });
    if (
      parsed.data.imageUrl !== undefined &&
      parsed.data.imageUrl !== existing.imageUrl
    ) {
      await releaseAssetIfUnused(existing.imageUrl);
    }
    return updated;
  } catch (e) {
    const mapped = toAppError(e);
    if (mapped.code === "DUPLICATE_RECORD") {
      throw errors.conflict("Another service uses that name.");
    }
    throw mapped;
  }
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while ((await prisma.service.findUnique({ where: { slug } })) ) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}