import { PrismaClient } from "@prisma/client";
import { env } from "@/config/env";

// Reuse a single PrismaClient across hot-reloads in dev to avoid exhausting
// the Postgres connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ["error", "warn"] : ["error", "warn"],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
