import "server-only";
import { prisma } from "@/lib/prisma";
import { errors } from "./errors";
import { requireAdmin } from "./guards";
import { recordAudit } from "./audit";
import { deleteImageAsset, isStorageUrl, storageKeyFromUrl, uploadImageAsset } from "./storage";
import type { SessionUser } from "./session";

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

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
 * Upload an uploaded image to Supabase Storage (admin only) and return the
 * public URL. Files live in the `uploads` bucket, so they survive deployments,
 * restarts and multi-instance hosting without consuming database space.
 */
export async function createImageAsset(
  user: SessionUser,
  file: { name: string; type: string; size: number; data: Buffer },
): Promise<string> {
  requireAdmin(user);
  assertValidImage(file);
  const url = await uploadImageAsset({
    data: file.data,
    contentType: file.type,
  });
  await recordAudit({
    userId: user.id,
    action: "admin.image.upload",
    entityType: "file",
    entityId: storageKeyFromUrl(url) ?? url,
    meta: { name: file.name, mimeType: file.type, size: file.size },
  });
  return url;
}

/**
 * Delete a previously uploaded image once nothing references it anymore.
 * Called when a dentist/service replaces or clears an image that pointed at an
 * uploaded file.
 */
export async function releaseAssetIfUnused(
  url: string | null | undefined,
): Promise<void> {
  if (!isStorageUrl(url)) return;
  const [dentistRefs, serviceRefs] = await Promise.all([
    prisma.dentist.count({ where: { photoUrl: url } }),
    prisma.service.count({ where: { imageUrl: url } }),
  ]);
  if (dentistRefs === 0 && serviceRefs === 0) {
    await deleteImageAsset(url);
  }
}