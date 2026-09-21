import "server-only";

/** Application error with an HTTP status and stable machine-readable code. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Prisma→AppError mapping for common constraint failures. */
export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  if (e instanceof Error && "code" in e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") {
      return new AppError(
        "DUPLICATE_RECORD",
        "A record with the same unique value already exists.",
        409,
      );
    }
    if (code === "P2025") {
      return new AppError("NOT_FOUND", "The requested record does not exist.", 404);
    }
    if (code === "P2003") {
      return new AppError(
        "REFERENCED_RECORD",
        "The operation references a record that does not exist.",
        422,
      );
    }
  }
  if (e instanceof Error) {
    // Never echo internal details to clients; log them server-side for
    // operational debugging instead.
    console.error("[internal error]", e.message, e.stack);
    return new AppError("INTERNAL", "Something went wrong.", 500);
  }
  return new AppError("INTERNAL", "Something went wrong.", 500);
}

export const errors = {
  unauthorized: (message = "Authentication required.") =>
    new AppError("UNAUTHORIZED", message, 401),
  forbidden: (message = "You are not allowed to perform this action.") =>
    new AppError("FORBIDDEN", message, 403),
  notFound: (what = "Record") =>
    new AppError("NOT_FOUND", `${what} not found.`, 404),
  validation: (details?: unknown) =>
    new AppError("VALIDATION", "The request data is invalid.", 422, details),
  conflict: (message = "The request conflicts with existing data.") =>
    new AppError("CONFLICT", message, 409),
  internal: (message = "Something went wrong.") =>
    new AppError("INTERNAL", message, 500),
  tooManyRequests: (message = "Too many requests — please slow down and try again.") =>
    new AppError("RATE_LIMITED", message, 429),
} as const;