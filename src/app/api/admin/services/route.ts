import { withAuth, ok, readJson } from "@/lib/server/route-helpers";
import { listServicesAdmin, createService } from "@/lib/server/services";

export const runtime = "nodejs";

export const GET = withAuth(async (user, _req, _ctx) => {
  const services = await listServicesAdmin(user);
  return ok({ services });
});

export const POST = withAuth(async (user, req, _ctx) => {
  const created = await createService(user, await readJson(req));
  return ok({ service: created }, 201);
});