import { NextRequest } from "next/server";
import { handlePaymentWebhook } from "@/lib/server/payments/engine";
import { toErrorResponse } from "@/lib/server/route-helpers";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const WEBHOOK_LIMIT = { limit: 600, windowMs: 10 * 60 * 1000 };

/**
 * Provider webhook endpoint. Consumes the raw body + signature exactly as the
 * provider transport sent them (no JSON parsing lossy round-trip), verifies
 * the HMAC signature, then funnels into the same server-side verify path used
 * everywhere. Idempotent by design: duplicate / replayed webhooks resolve to
 * the same Payment row and are terminal-suppressed.
 *
 * Throttled per client IP as defense-in-depth; the signature check remains the
 * real gate for paystack deliveries.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  try {
    checkRateLimit(`webhook:ip:${clientIp(req)}`, WEBHOOK_LIMIT);
    const result = await handlePaymentWebhook(rawBody, { signature });
    return new Response(JSON.stringify({ payment: result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    // Providers retry non-2xx; 401/4xx flags an invalid signature upstream.
    return toErrorResponse(e);
  }
}