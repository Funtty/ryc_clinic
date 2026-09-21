import { withAuth, ok } from "@/lib/server/route-helpers";
import { destroySessionFromCookie } from "@/lib/server/session-cookie";

export const runtime = "nodejs";

export const POST = withAuth(async (_user, _req, _ctx) => {
  await destroySessionFromCookie();
  return ok({ ok: true });
});