import { withAuth, ok, readJson } from "@/lib/server/route-helpers";
import { createDentist, listDentistsAdmin } from "@/lib/server/dentists";

export const runtime = "nodejs";

export const GET = withAuth(async (user, _req, _ctx) => {
  const dentists = await listDentistsAdmin(user);
  return ok({ dentists });
});

export const POST = withAuth(async (user, req, _ctx) => {
  const created = await createDentist(user, await readJson(req));
  return ok({ dentist: created }, 201);
});