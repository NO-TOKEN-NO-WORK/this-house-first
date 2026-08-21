import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 클라이언트 싱글턴 (ADR-0013: Prisma Postgres).
 *
 * Prisma 7은 런타임에 driver adapter가 필수다. Vercel의 함수 런타임은 Node이므로
 * 표준 경로인 `@prisma/adapter-pg`(pg 드라이버)를 쓴다 — 엣지 전용 어댑터가 아니다.
 *
 * 서버리스에서는 함수 인스턴스마다 풀이 생기므로 인스턴스당 커넥션을 적게 잡고,
 * 접속은 풀러 엔드포인트(pooled.db.prisma.io)를 쓰는 것을 권장한다(README 참고).
 * dev 서버 핫 리로드에서 커넥션이 불어나지 않도록 globalThis에 캐시한다.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL이 없습니다. `cp .env.example .env` 후 Prisma Postgres 연결 문자열을 넣으세요 (docs/adr/0013-prisma-postgres.md).",
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      // 서버리스 인스턴스가 여러 개 뜨므로 인스턴스당 커넥션은 작게 잡는다
      max: 5,
    }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
