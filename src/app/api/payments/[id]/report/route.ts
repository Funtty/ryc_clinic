import { NextRequest } from "next/server";
import { reportBankTransfer } from "@/lib/server/payments/engine";
import { ok, toErrorResponse } from "@/lib/server/route-helpers";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const REPORT_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

/**
 * Patient "I've made payment" claim for the bank_transfer provider. This
 * records a CLAIM only — it never changes the payment status. The payment
 * stays PENDING until an admin checks the bank and confirms receipt (see
 * POST /api/admin/payments/[id]/confirm). Unauthenticated by design, throttled
 * per client IP like the verify route.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    checkRateLimit(`report:ip:${clientIp(req)}`, REPORT_LIMIT);
    const { id } = await params;
    const result = await reportBankTransfer(id);
    return ok({ payment: result });
  } catch (e) {
    return toErrorResponse(e);
  }
}