import { withAuth, ok, readJson } from "@/lib/server/route-helpers";
import { updateService } from "@/lib/server/services";

export const runtime = "nodejs";

export const PATCH = withAuth(async (user, req, ctx) => {
  const { id } = await ctx.params;
  const updated = await updateService(user, id, await readJson(req));
  return ok({ service: updated });
});