import { withAuth, ok } from "@/lib/server/route-helpers";
import { listAuditLogs } from "@/lib/server/admin";

export const runtime = "nodejs";

export const GET = withAuth(async (user, req, _ctx) => {
  const url = new URL(req.url);
  const raw = {
    action: url.searchParams.get("action") ?? undefined,
    entityType: url.searchParams.get("entityType") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  };
  const result = await listAuditLogs(user, raw);
  return ok(result);
});