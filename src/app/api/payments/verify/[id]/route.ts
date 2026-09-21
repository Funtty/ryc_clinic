import { NextRequest } from "next/server";
import { verifyDeposit } from "@/lib/server/payments/engine";
import { ok, toErrorResponse } from "@/lib/server/route-helpers";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const VERIFY_LIMIT = { limit: 30, windowMs: 15 * 60 * 1000 };

/**
 * Patient "I've returned from the provider" route. It NEVER declares success:
 * it asks the server to run provider verification (which is also exactly what
 * a signature-checked webhook does). The provider's verdict, not the browser,
 * decides the payment status.
 *
 * Unauthenticated by design (the patient has no portal account at checkout),
 * so it is throttled per client IP to stop status-oracle polling and
 * verification-cost abuse.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    checkRateLimit(`verify:ip:${clientIp(req)}`, VERIFY_LIMIT);
    const { id } = await params;
    const result = await verifyDeposit(id);
    return ok({ payment: { status: result.status, paidAt: result.paidAt } });
  } catch (e) {
    return toErrorResponse(e);
  }
}