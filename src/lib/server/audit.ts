import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: unknown;
  ip?: string | null;
};

type AuditDb = Pick<Prisma.TransactionClient, "auditLog">;

/**
 * Append an immutable audit record. Never called from the client. Pass `tx`
 * when called inside an interactive transaction so the write joins it instead
 * of deadlocking against the transaction's SQLite lock.
 */
export async function recordAudit(
  input: AuditInput,
  db: AuditDb = prisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType ?? "",
      entityId: input.entityId ?? "",
      meta:
        input.meta === undefined
          ? ""
          : JSON.stringify(input.meta).slice(0, 4000),
      ip: input.ip ?? null,
    },
  });
}