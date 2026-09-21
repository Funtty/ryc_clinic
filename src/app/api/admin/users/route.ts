import { NextRequest } from "next/server";
import { withAuth, ok, readJson } from "@/lib/server/route-helpers";
import {
  listStaffUsers,
  createStaffUser,
} from "@/lib/server/admin";

export const runtime = "nodejs";

export const GET = withAuth(async (user, _req: NextRequest) => {
  return ok({ users: await listStaffUsers(user) });
});

export const POST = withAuth(async (user, req: NextRequest) => {
  const created = await createStaffUser(user, await readJson(req));
  return ok({ user: created }, 201);
});