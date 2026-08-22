import type { Prisma } from "@/generated/prisma/client";

/** 같은 날짜에 데모와 실제 경보가 공존하면 현재 화면·기록은 데모를 사용한다. */
export function findActiveAlertDay(
  client: Pick<Prisma.TransactionClient, "alertDay">,
  date: string,
) {
  return client.alertDay.findFirst({
    where: { date },
    orderBy: { isDemo: "desc" },
  });
}
