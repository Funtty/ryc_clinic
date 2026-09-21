import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { errors } from "./errors";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  destroySession,
  resolveSession,
  type SessionUser,
} from "./session";

export { SESSION_COOKIE };

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Read the session cookie and resolve the authenticated user (throws 401). */
export async function getSessionUser(): Promise<SessionUser> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) throw errors.unauthorized();
  return resolveSession(token);
}

/** Like getSessionUser but returns null for anonymous visitors (UI use). */
export async function getSessionUserSafe(): Promise<SessionUser | null> {
  try {
    return await getSessionUser();
  } catch {
    return null;
  }
}

/** Log out: invalidate the session identified by the cookie, then clear it. */
export async function destroySessionFromCookie(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token).catch(() => undefined);
  store.delete(SESSION_COOKIE);
}