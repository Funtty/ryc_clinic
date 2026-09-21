import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const STORAGE_BUCKET = env.SUPABASE_STORAGE_BUCKET || "uploads";

let client: SupabaseClient | null = null;

/**
 * Service-role Supabase client used for Storage operations. Fails loudly when
 * the project isn't configured rather than silently uploading nowhere.
 */
export function storageClient(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured — Storage unavailable.",
    );
  }
  client ??= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

function extForMime(mimeType: string): string {
  return MIME_EXT[mimeType.toLowerCase()] ?? "";
}

/** Upload bytes into the public `uploads` bucket and return the public URL. */
export async function uploadImageAsset(file: {
  data: Uint8Array;
  contentType: string;
}): Promise<string> {
  const sb = storageClient();
  const key = `images/${crypto.randomUUID()}${extForMime(file.contentType)}`;

  const { error: bucketError } = await sb.storage
    .createBucket(STORAGE_BUCKET, { public: true })
    .catch((e) => ({ error: e as { message?: string } }));
  // createBucket throws on already-exists; that's fine — treat 400 "already
  // exists" as success.
  if (bucketError && !/already exists/i.test(bucketError.message ?? "")) {
    throw new Error(`Storage bucket unavailable: ${bucketError.message}`);
  }

  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(key, file.data, {
    contentType: file.contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

/** Delete an object from Storage if `url` points at this project's bucket. */
export async function deleteImageAsset(url: string): Promise<void> {
  const key = storageKeyFromUrl(url);
  if (!key) return;
  const { error } = await storageClient().storage.from(STORAGE_BUCKET).remove([key]);
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

/** True when a URL points into a Supabase public storage bucket. */
export function isStorageUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && url.includes("/storage/v1/object/public/");
}

/** Strip a public storage URL down to its object key (null if not ours). */
export function storageKeyFromUrl(url: string): string | null {
  const match = url.match(/\/object\/public\/[^/]+\/(.+)$/);
  return match ? decodeURIComponent(match[1] ?? "") : null;
}