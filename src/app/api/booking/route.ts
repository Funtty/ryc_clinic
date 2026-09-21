import { NextRequest } from "next/server";
import { createPublicBooking } from "@/lib/server/public-booking";
import { ok, readJson, toErrorResponse } from "@/lib/server/route-helpers";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOOKING_LIMIT = { limit: 20, windowMs: 15 * 60 * 1000 };

export async function POST(req: NextRequest) {
  try {
    checkRateLimit(`booking:ip:${clientIp(req)}`, BOOKING_LIMIT);
    const booking = await createPublicBooking(await readJson(req));
    return ok({ booking }, 201);
  } catch (e) {
    return toErrorResponse(e);
  }
}