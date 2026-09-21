import "server-only";
import { prisma } from "@/lib/prisma";
import { errors } from "./errors";
import { requireAdmin } from "./guards";
import { recordAudit } from "./audit";
import type { SessionUser } from "./session";

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

const ASSET_PREFIX = "/api/files/";

export function assetUrl(id: string): string {
  return `${ASSET_PREFIX}${id}`;
}

export function isAssetUrl(url: string | null | undefined): url is string {
  return url != null && url.length > 0 && url.startsWith(ASSET_PREFIX);
}

export function assetIdFromUrl(url: string): string | null {
  return url.startsWith(ASSET_PREFIX) ? url.slice(ASSET_PREFIX.length) : null;
}

export function assertValidImage(file: {
  name?: string;
  type?: string;
  size?: number;
}): void {
  const type = (file.type ?? "").toLowerCase();
  if (!type || !ALLOWED_IMAGE_MIMES.has(type)) {
    throw errors.validation({
      file: "Only JPEG, PNG, WebP, AVIF and GIF images are supported.",
    });
  }
  if (!file.name || file.name.trim() === "") {
    throw errors.validation({ file: "The image file has no name." });
  }
  if (!file.size || file.size <= 0) {
    throw errors.validation({ file: "The image file is empty." });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw errors.validation({ file: "Images must be 8 MB or smaller." });
  }
}

/**
 * Store an uploaded image in the database (admin only) and return the public
 * URL used to serve it. Bytes live in the DB so files survive deployments,
 * restarts and multi-instance hosting.
 */
export async function createImageAsset(
  user: SessionUser,
  file: { name: string; type: string; size: number; data: Buffer },
): Promise<string> {
  requireAdmin(user);
  assertValidImage(file);
  const asset = await prisma.fileAsset.create({
    data: {
      name: file.name,
      mimeType: file.type,
      size: file.size,
      data: file.data as unknown as Uint8Array<ArrayBuffer>,
      userId: user.id,
    },
  });
  await recordAudit({
    userId: user.id,
    action: "admin.image.upload",
    entityType: "file",
    entityId: asset.id,
    meta: { name: file.name, mimeType: file.type, size: file.size },
  });
  return assetUrl(asset.id);
}

/**
 * Delete a previously uploaded asset once nothing references it anymore.
 * Called when a dentist/service replaces or clears an image that pointed at an
 * uploaded file.
 */
export async function releaseAssetIfUnused(
  url: string | null | undefined,
): Promise<void> {
  if (!isAssetUrl(url)) return;
  const assetId = assetIdFromUrl(url);
  if (!assetId) return;
  const [dentistRefs, serviceRefs] = await Promise.all([
    prisma.dentist.count({ where: { photoUrl: url } }),
    prisma.service.count({ where: { imageUrl: url } }),
  ]);
  if (dentistRefs === 0 && serviceRefs === 0) {
    await prisma.fileAsset.deleteMany({ where: { id: assetId } });
  }
}