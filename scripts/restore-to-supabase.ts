// One-time migration helper: rehydrate scripts/_sqlite-dump.json into Supabase
// Postgres (public schema). Preserves row ids where possible, pushes the old
// in-database image bytes into Supabase Storage, and rewrites /api/files/:id
// URLs to the new public Storage URLs.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const DUMP_FILE = path.join(process.cwd(), "scripts", "_sqlite-dump.json");
const ASSET_PREFIX = "/api/files/";

const sb = createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "uploads";

function ensureBucket() {
  const sbC = sb.storage.from(bucket);
  return sbC;
}

async function ensureBucketExists() {
  try {
    const { error } = await sb.storage.createBucket(bucket, { public: true });
    if (error && !/already exists/i.test(error.message)) throw error;
  } catch (e) {
    const err = e as { message?: string };
    if (!/already exists/i.test(err.message ?? "")) throw err;
  }
}

async function uploadBytes(key: string, data: Uint8Array, contentType: string): Promise<string> {
  const { error } = await ensureBucket().upload(key, data, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed for ${key}: ${error.message}`);
  const { data: pub } = ensureBucket().getPublicUrl(key);
  return pub.publicUrl;
}

async function createIfMissing(model: unknown, data: object): Promise<boolean> {
  const creator = (model as { create: (args: { data: object }) => Promise<unknown> }).create;
  try {
    await creator({ data });
    return true;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") return false; // already exists — keep going
    throw e;
  }
}

type Dump = {
  users: object[];
  sessions: object[];
  patients: object[];
  dentists: object[];
  services: object[];
  serviceDentistPairs: { serviceId: string; dentistId: string }[];
  clinicHours: object[];
  dentistSchedules: object[];
  blockedDates: object[];
  appointments: object[];
  payments: object[];
  enquiries: object[];
  notifications: object[];
  auditLogs: object[];
  fileAssets: { id: string; name: string; mimeType: string; size: number; dataB64: string }[];
};

async function main() {
  const dump = JSON.parse(fs.readFileSync(DUMP_FILE, "utf-8")) as Dump;
  if (!dump.fileAssets && !(dump as { version?: number }).version) {
    console.error("Unexpected dump shape — refusing to run.");
    process.exit(1);
  }

  await ensureBucketExists();
  console.log(`Bucket '${bucket}' ready.`);

  // 1) Push the old in-database image bytes into Storage and map assetId -> URL.
  const assetIdToUrl = new Map<string, string>();
  for (const asset of dump.fileAssets ?? []) {
    const key = `images/${asset.id}${extForMime(asset.mimeType)}`;
    const url = await uploadBytes(key, Buffer.from(asset.dataB64, "base64"), asset.mimeType);
    assetIdToUrl.set(asset.id, url);
    console.log(`  uploaded ${asset.name} → ${url}`);
  }

  const rewrite = (url: string | null | undefined): string | null => {
    if (!url || !url.startsWith(ASSET_PREFIX)) return url ?? null;
    const assetId = url.slice(ASSET_PREFIX.length);
    return assetIdToUrl.get(assetId) ?? null;
  };

  const created: Record<string, number> = {};
  const count = <T extends object[]>(rows: T, key: string) => {
    created[key] = (created[key] ?? 0) + rows.length;
  };

  for (const u of dump.users) {
    await createIfMissing(prisma.user, { id: (u as { id: string }).id, ...u });
  }
  count(dump.users, "users");

  for (const s of dump.sessions) {
    await createIfMissing(prisma.session, { id: (s as { id: string }).id, ...s });
  }
  count(dump.sessions, "sessions");

  for (const p of dump.patients) {
    await createIfMissing(prisma.patient, { id: (p as { id: string }).id, ...p });
  }
  count(dump.patients, "patients");

  for (const d of dump.dentists) {
    await createIfMissing(prisma.dentist, { id: (d as { id: string }).id, ...d });
  }
  count(dump.dentists, "dentists");

  for (const s of dump.services) {
    await createIfMissing(prisma.service, { id: (s as { id: string }).id, ...s });
  }
  count(dump.services, "services");

  for (const h of dump.clinicHours) {
    await createIfMissing(prisma.clinicHours, { id: (h as { id: string }).id, ...h });
  }
  count(dump.clinicHours, "clinicHours");

  for (const ds of dump.dentistSchedules) {
    await createIfMissing(prisma.dentistSchedule, { id: (ds as { id: string }).id, ...ds });
  }
  count(dump.dentistSchedules, "dentistSchedules");

  for (const bd of dump.blockedDates) {
    await createIfMissing(prisma.blockedDate, { id: (bd as { id: string }).id, ...bd });
  }
  count(dump.blockedDates, "blockedDates");

  for (const a of dump.appointments) {
    await createIfMissing(prisma.appointment, { id: (a as { id: string }).id, ...a });
  }
  count(dump.appointments, "appointments");

  for (const p of dump.payments) {
    await createIfMissing(prisma.payment, { id: (p as { id: string }).id, ...p });
  }
  count(dump.payments, "payments");

  for (const e of dump.enquiries) {
    await createIfMissing(prisma.enquiry, { id: (e as { id: string }).id, ...e });
  }
  count(dump.enquiries, "enquiries");

  for (const n of dump.notifications) {
    await createIfMissing(prisma.notification, { id: (n as { id: string }).id, ...n });
  }
  count(dump.notifications, "notifications");

  for (const al of dump.auditLogs) {
    await createIfMissing(prisma.auditLog, { id: (al as { id: string }).id, ...al });
  }
  count(dump.auditLogs, "auditLogs");

  // 2) Re-link services <-> dentists (implicit join table).
  let links = 0;
  for (const pair of dump.serviceDentistPairs) {
    try {
      await prisma.service.update({
        where: { id: pair.serviceId },
        data: { dentists: { connect: { id: pair.dentistId } } },
      });
      links += 1;
    } catch {
      // one side missing — skip
    }
  }

  // 3) Rewrite any photoUrl/imageUrl that pointed at the old /api/files/:id.
  let urlRewrites = 0;
  for (const d of dump.dentists) {
    const row = d as { id: string; photoUrl: string | null };
    const newUrl = rewrite(row.photoUrl);
    if (newUrl && newUrl !== row.photoUrl) {
      await prisma.dentist.update({ where: { id: row.id }, data: { photoUrl: newUrl } });
      urlRewrites += 1;
    }
  }
  for (const s of dump.services) {
    const row = s as { id: string; imageUrl: string | null };
    const newUrl = rewrite(row.imageUrl);
    if (newUrl && newUrl !== row.imageUrl) {
      await prisma.service.update({ where: { id: row.id }, data: { imageUrl: newUrl } });
      urlRewrites += 1;
    }
  }

  console.log("Restore complete:", created, `+ ${links} service→dentist links, ${urlRewrites} URL rewrites`);
}

function extForMime(mimeType: string): string {
  const ext: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
  };
  return ext[(mimeType ?? "").toLowerCase()] ?? "";
}

main()
  .catch((e) => {
    console.error("Restore failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });