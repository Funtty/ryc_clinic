import { withAuth, ok } from "@/lib/server/route-helpers";
import { requireAdmin } from "@/lib/server/guards";
import { errors } from "@/lib/server/errors";
import { listPayments } from "@/lib/server/payments/engine";
import { paymentListQuerySchema } from "@/lib/server/validators";

export const runtime = "nodejs";

export const GET = withAuth(async (user, req, _ctx) => {
  requireAdmin(user);
  // Fail closed: an invalid filter is a client error, never a silent
  // unfiltered dump of the payment table.
  const query = paymentListQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!query.success) throw errors.validation(query.error.flatten());
  const payments = await listPayments({ status: query.data.status });
  return ok({ payments });
});