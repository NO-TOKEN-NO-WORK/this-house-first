import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 클라이언트 싱글턴.
 * Prisma 7은 driver adapter가 필수다 (ADR-0004, .agents/skills/prisma-database-setup).
 * Next.js dev 서버의 핫 리로드에서 커넥션이 불어나지 않도록 globalThis에 캐시한다.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
    }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
