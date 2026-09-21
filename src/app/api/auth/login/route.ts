import { NextRequest } from "next/server";
import { toErrorResponse, ok, readJson } from "@/lib/server/route-helpers";
import { loginWithPassword } from "@/lib/server/auth";
import { setSessionCookie } from "@/lib/server/session-cookie";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

// Brute-force throttle: a tight per-account window (per client) plus a loose
// per-IP cap so a distributed credential spray across many emails still hits a
// wall, but a handful of legitimate concurrent logins from one NAT is fine.
const LOGIN_ACCOUNT_LIMIT = { limit: 20, windowMs: 15 * 60 * 1000 };
const LOGIN_IP_LIMIT = { limit: 120, windowMs: 15 * 60 * 1000 };

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await readJson(req)) as
      | { email?: unknown; password?: unknown }
      | undefined;
    const ip = clientIp(req);
    // Normalise email here so the per-account window is stable across
    // casing/whitespace variations (the service normalises again internally).
    const email = String(body?.email ?? "").trim().toLowerCase();
    checkRateLimit(`login:ip:${ip}`, LOGIN_IP_LIMIT);
    if (email) checkRateLimit(`login:acct:${ip}:${email}`, LOGIN_ACCOUNT_LIMIT);
    const { token, user } = await loginWithPassword(
      body?.email,
      body?.password,
      { userAgent: req.headers.get("user-agent") ?? undefined, ip },
    );
    await setSessionCookie(token);
    return ok({ user });
  } catch (e) {
    return toErrorResponse(e);
  }
}