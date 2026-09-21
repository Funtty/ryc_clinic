import { withAuth, ok, toErrorResponse } from "@/lib/server/route-helpers";
import { requireAdmin } from "@/lib/server/guards";
import { refundDeposit } from "@/lib/server/payments/engine";
import { recordAudit } from "@/lib/server/audit";

export const runtime = "nodejs";

export const POST = withAuth(async (user, _req, ctx) => {
  requireAdmin(user);
  try {
    const { id } = await ctx.params;
    const result = await refundDeposit(id);
    await recordAudit({
      userId: user.id,
      action: "payment.deposit.refunded.by_admin",
      entityType: "payment",
      entityId: id,
      meta: JSON.stringify({ to: result.status }),
    });
    return ok({ payment: result }, 200);
  } catch (e) {
    return toErrorResponse(e);
  }
});