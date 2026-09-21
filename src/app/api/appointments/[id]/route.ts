import { NextRequest } from "next/server";
import {
  withAuth,
  ok,
  readJson,
  type RouteContext,
} from "@/lib/server/route-helpers";
import { errors } from "@/lib/server/errors";
import {
  getAppointment,
  transitionAppointment,
  rescheduleAppointment,
} from "@/lib/server/appointments";

export const runtime = "nodejs";

async function idFrom(ctx: RouteContext) {
  return (await ctx.params).id;
}

export const GET = withAuth(async (user, _req: NextRequest, ctx) => {
  const appointment = await getAppointment(user, await idFrom(ctx));
  return ok({ appointment });
});

export const PATCH = withAuth(async (user, req: NextRequest, ctx) => {
  const id = await idFrom(ctx);
  const body = (await readJson(req)) as Record<string, unknown> | undefined;

  if (!body) throw errors.validation();

  if (body.startsAt !== undefined) {
    const appointment = await rescheduleAppointment(user, id, body);
    return ok({ appointment });
  }
  if (body.status !== undefined) {
    const appointment = await transitionAppointment(user, id, body);
    return ok({ appointment });
  }
  throw errors.validation();
});