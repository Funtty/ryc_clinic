import { NextRequest } from "next/server";
import { withAuth, ok, readJson } from "@/lib/server/route-helpers";
import { requireStaff } from "@/lib/server/guards";
import {
  getClinicHoursAdmin,
  updateClinicHours,
} from "@/lib/server/admin";

export const runtime = "nodejs";

export const GET = withAuth(async (user, _req: NextRequest) => {
  requireStaff(user);
  return ok({ clinicHours: await getClinicHoursAdmin() });
});

export const PUT = withAuth(async (user, req: NextRequest) => {
  const clinicHours = await updateClinicHours(user, await readJson(req));
  return ok({ clinicHours });
});