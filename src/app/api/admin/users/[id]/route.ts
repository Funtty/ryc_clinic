import { NextRequest } from "next/server";
import { withAuth, ok, readJson } from "@/lib/server/route-helpers";
import { updateStaffUser } from "@/lib/server/admin";

export const runtime = "nodejs";

export const PATCH = withAuth(async (user, req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  const updated = await updateStaffUser(user, id, await readJson(req));
  return ok({ user: updated });
});