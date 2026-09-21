import "server-only";
import { errors } from "./errors";
import type { SessionUser } from "./session";

type Role = "ADMIN" | "STAFF";

export function isRole(user: Pick<SessionUser, "role">, roles: Role[]): boolean {
  return roles.includes(user.role as Role);
}

export function assertRole(
  user: Pick<SessionUser, "role">,
  roles: Role[],
): asserts user is SessionUser {
  if (!isRole(user, roles)) {
    throw errors.forbidden("You are not allowed to perform this action.");
  }
}

export const requireStaff = (user: Pick<SessionUser, "role">) => assertRole(user, ["ADMIN", "STAFF"]);
export const requireAdmin = (user: Pick<SessionUser, "role">) => assertRole(user, ["ADMIN"]);