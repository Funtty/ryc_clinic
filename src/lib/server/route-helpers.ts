import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser } from "./session-cookie";
import type { SessionUser } from "./session";
import { isAppError, toAppError } from "./errors";

export type RouteContext = { params: Promise<Record<string, string>> };
type Handler = (
  user: SessionUser,
  req: NextRequest,
  ctx: RouteContext,
) => Promise<NextResponse>;

/** Auth + error boundary shared by every API route. */
export function withAuth(handler: Handler) {
  return async (req: NextRequest, ctx: RouteContext) => {
    try {
      const user = await getSessionUser();
      return await handler(user, req, ctx);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

export function toErrorResponse(e: unknown): NextResponse {
  const app = isAppError(e) ? e : toAppError(e);
  return NextResponse.json(
    {
      error: {
        code: app.code,
        message: app.message,
        ...(app.details !== undefined ? { details: app.details } : {}),
      },
    },
    { status: app.status },
  );
}

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}