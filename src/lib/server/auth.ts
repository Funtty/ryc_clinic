import "server-only";
import { prisma } from "@/lib/prisma";
import { errors } from "./errors";
import { verifyPassword } from "./password";
import { createSession } from "./session";
import { recordAudit } from "./audit";

export type LoginUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type LoginResult = { token: string; user: LoginUser };

/**
 * Fixed 12-round bcrypt hash of a throwaway password, used to keep timing
 * constant whether or not the email address exists (avoids account
 * enumeration via response timing).
 */
const DUMMY_HASH =
  "$2b$12$KuXaXJq26uKFeGxWnDXfg.7XERhM/tn0qFRqxahuWWGS3UHD7lg5e";

/** Validate credentials and start a server-side session. */
export async function loginWithPassword(
  email: unknown,
  password: unknown,
  meta?: { userAgent?: string; ip?: string },
): Promise<LoginResult> {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized || typeof password !== "string" || password.length === 0) {
    throw errors.validation({ credentials: ["Username or email and password are required"] });
  }

  // Accept a staff username OR their email as the login identifier. A username
  // match wins when an email happens to collide with another user's username.
  const byUsername = await prisma.user.findUnique({ where: { username: normalized } });
  const byEmail = await prisma.user.findUnique({ where: { email: normalized } });
  const user = byUsername ?? byEmail;

  // Verify regardless so missing and wrong creds cost the same work.
  const hash = user ? user.passwordHash : DUMMY_HASH;
  const passwordOk = await verifyPassword(password, hash);

  if (!user || !passwordOk) {
    // Failed attempts are audited (with the attempted identifier + client IP)
    // so brute-force forensics work even when nothing is "wrong" with the
    // account. No per-account detail goes into the audit meta beyond the
    // public email the caller already sent.
    await prisma.auditLog
      .create({
        data: {
          userId: user?.id ?? null,
          action: "auth.login.failed",
          entityType: "user",
          entityId: user?.id ?? normalized,
          meta: JSON.stringify({ email: normalized }),
          ip: meta?.ip ?? null,
        },
      })
      .catch(() => undefined);
    throw errors.unauthorized("Incorrect email or password.");
  }
  if (!user.isActive) {
    await prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: "auth.login.disabled",
          entityType: "user",
          entityId: user.id,
          meta: JSON.stringify({ email: normalized }),
          ip: meta?.ip ?? null,
        },
      })
      .catch(() => undefined);
    throw errors.forbidden("This account is disabled. Contact an administrator.");
  }

  const token = await createSession(user.id, { userAgent: meta?.userAgent });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({
    userId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    meta: { method: "password" },
    ip: meta?.ip ?? null,
  });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}