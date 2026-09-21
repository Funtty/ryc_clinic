import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // The Supabase pooler is slower than a local socket (hundreds of ms per
    // round-trip), so interactive transactions need a generous budget. The
    // default 5s timeout aborts legitimate flows on laggy pool servers.
    transactionOptions: {
      maxWait: 30000,
      timeout: 120000,
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;