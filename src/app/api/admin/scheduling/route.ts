import { NextRequest } from "next/server";
import { withAuth, ok, readJson } from "@/lib/server/route-helpers";
import { errors } from "@/lib/server/errors";
import { schedulingQuerySchema } from "@/lib/server/validators";
import {
  getSchedules,
  upsertSchedule,
  deleteSchedule,
  listBlockedDates,
  createBlockedDate,
  deleteBlockedDate,
} from "@/lib/server/admin";

export const runtime = "nodejs";

export const GET = withAuth(async (user, req: NextRequest) => {
  const query = schedulingQuerySchema.safeParse({
    dentistId: req.nextUrl.searchParams.get("dentistId") ?? undefined,
    date: req.nextUrl.searchParams.get("date") ?? undefined,
  });
  if (!query.success) throw errors.validation(query.error.flatten());
  const [schedules, blockedDates] = await Promise.all([
    getSchedules(user, query.data.dentistId),
    listBlockedDates(user, query.data.date),
  ]);
  return ok({ schedules, blockedDates });
});

export const POST = withAuth(async (user, req: NextRequest) => {
  const body = (await readJson(req)) as Record<string, unknown> | undefined;
  if (!body || typeof body.kind !== "string") throw errors.validation();

  if (body.kind === "schedule") {
    return ok({ schedule: await upsertSchedule(user, body) }, 201);
  }
  if (body.kind === "blocked-date") {
    return ok({ blockedDate: await createBlockedDate(user, body) }, 201);
  }
  throw errors.validation();
});

export const DELETE = withAuth(async (user, req: NextRequest) => {
  const kind = req.nextUrl.searchParams.get("kind");
  const id = req.nextUrl.searchParams.get("id");
  if (!id) throw errors.validation();

  if (kind === "schedule") {
    await deleteSchedule(user, id);
  } else if (kind === "blocked-date") {
    await deleteBlockedDate(user, id);
  } else {
    throw errors.validation();
  }
  return ok({ deleted: true });
});