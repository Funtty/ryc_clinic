import { NextRequest } from "next/server";
import { withAuth, ok, readJson } from "@/lib/server/route-helpers";
import { listAppointments, createAppointment } from "@/lib/server/appointments";

export const runtime = "nodejs";

export const GET = withAuth(async (user, req: NextRequest) => {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  return ok({ appointments: await listAppointments(user, params) });
});

export const POST = withAuth(async (user, req: NextRequest) => {
  const appointment = await createAppointment(user, await readJson(req));
  return ok({ appointment }, 201);
});