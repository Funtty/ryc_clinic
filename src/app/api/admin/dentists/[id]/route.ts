import { withAuth, ok, readJson } from "@/lib/server/route-helpers";
import { getDentistAdmin, updateDentist } from "@/lib/server/dentists";

export const runtime = "nodejs";

export const GET = withAuth(async (user, _req, ctx) => {
  const { id } = await ctx.params;
  const dentist = await getDentistAdmin(user, id);
  return ok({ dentist });
});

export const PATCH = withAuth(async (user, req, ctx) => {
  const { id } = await ctx.params;
  const updated = await updateDentist(user, id, await readJson(req));
  return ok({ dentist: updated });
});