import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { errors } from "./errors";

export const SESSION_COOKIE = "ryc_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
// Sliding idle timeout: an authenticated session is invalidated if it goes
// unused for this long, even though its absolute lifetime hasn't elapsed.
export const SESSION_IDLE_MAX_SECONDS = 12 * 60 * 60;
// Bounded renewal granularity — at most one DB touch per session per interval.
const SESSION_RENEW_AFTER_SECONDS = 15 * 60;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function randomToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Persist a new server-side session for `userId` and return the raw bearer
 * token. Only the SHA-256 hash of the token is stored; the raw token is handed
 * to the client once and kept in an httpOnly cookie.
 */
export async function createSession(
  userId: string,
  meta?: { userAgent?: string },
): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const lastSeenAt = new Date();
  await prisma.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt,
      lastSeenAt,
      userAgent: meta?.userAgent ?? null,
    },
  });
  return token;
}

/** Resolve a raw session token to its user, rejecting expired or idle sessions. */
export async function resolveSession(token: string): Promise<SessionUser> {
  const row = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { user: true },
  });
  if (!row || !row.user) throw errors.unauthorized();
  const now = Date.now();
  const idleMs =
    row.lastSeenAt && row.lastSeenAt.getTime() > row.createdAt.getTime()
      ? now - row.lastSeenAt.getTime()
      : now - row.createdAt.getTime();
  if (row.expiresAt.getTime() < now || idleMs > SESSION_IDLE_MAX_SECONDS * 1000) {
    await prisma.session.delete({ where: { id: row.id } }).catch(() => undefined);
    throw errors.unauthorized("Your session has expired. Please sign in again.");
  }
  if (!row.user.isActive) throw errors.forbidden("This account is disabled.");
  // Sliding renewal: mark activity at most once per renewal interval so an
  // active clinician never hits the idle timeout, without a DB write per hit.
  if (idleMs > SESSION_RENEW_AFTER_SECONDS * 1000) {
    await prisma.session
      .update({
        where: { id: row.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => undefined);
  }
  return {
    id: row.user.id,
    email: row.user.email,
    name: row.user.name,
    role: row.user.role,
    isActive: row.user.isActive,
  };
}

/** Delete a session (logout). */
export async function destroySession(token: string): Promise<void> {
  await prisma.session.delete({ where: { id: sha256(token) } }).catch(() => undefined);
}

/** Constant-time token comparison (kept for the auth suite + future reuse). */
export function tokenMatches(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}