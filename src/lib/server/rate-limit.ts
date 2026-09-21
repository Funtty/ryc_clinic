import "server-only";
import { errors } from "./errors";

// Lightweight in-memory fixed-window rate limiter. One per API server process.
//
// This is not a distributed limiter: behind horizontally scaled instances each
// worker keeps its own window. For the single-process deployments this app
// targets (SQLite + one Next.js instance) it is an effective throttle against
// online brute force, calendar exhaustion and forgotten-webhook floods. Keep
// window sizes small enough that a replay of legitimate traffic never trips it.

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();
const MAX_BUCKETS = 10_000;

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): void {
  const now = Date.now();
  if (buckets.size >= MAX_BUCKETS) {
    // Evict the oldest window defensively so a key flood cannot exhaust memory.
    let oldestKey: string | undefined;
    let oldestReset = Infinity;
    for (const [k, w] of buckets) {
      if (w.resetAt < oldestReset) {
        oldestReset = w.resetAt;
        oldestKey = k;
      }
    }
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return;
  }
  existing.count += 1;
  if (existing.count > opts.limit) {
    throw errors.tooManyRequests();
  }
}

/** Reject a client by IP using the de-facto first hop of x-forwarded-for. */
export function clientIp(req: { headers: Headers }): string {
  const fwd = req.headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

/** Test hook: clear all windows. */
export function resetRateLimiter(): void {
  buckets.clear();
}