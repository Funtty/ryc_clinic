import { withAuth, ok } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

export const GET = withAuth(async (user, _req, _ctx) => {
  return ok({ user });
});