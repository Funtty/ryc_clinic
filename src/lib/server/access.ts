import "server-only";
import { getSessionUser } from "./session-cookie";
import { requireAdmin, requireStaff } from "./guards";
import { isAppError } from "./errors";
import type { SessionUser } from "./session";

/**
 * Page-level guards for the admin area. Server components call these instead
 * of reaching for the cookie directly; the same guards are enforced again at
 * the service and API layers, never relying on the frontend.
 */
export async function requireStaffPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  requireStaff(user);
  return user;
}

export async function requireAdminPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  requireAdmin(user);
  return user;
}

/**
 * Variant for admin-only pages: returns the user when they are an admin, or
 * null when the visitor is genuinely authenticated but lacks the ADMIN role.
 * The layout already redirected anonymous visitors to /ryc_login, so null here
 * means "logged-in staff" and the page renders an explicit NotAuthorized view.
 */
export async function authorizeAdminPage(): Promise<SessionUser | null> {
  try {
    return await requireAdminPage();
  } catch (e) {
    if (isAppError(e)) return null;
    throw e;
  }
}