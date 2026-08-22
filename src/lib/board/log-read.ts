import { prisma } from "../db";
import { WorkerRole } from "../domain";
import { formatBoardDate } from "./format";
import { groupLogItems, type LogView, toLogItems } from "./log";
import { type BoardWorker, todayInKst } from "./today";

/**
 * 선택한 담당자의 확인 기록만 읽는다. AlertDay·CheckEvent·알림을 만들지 않는다.
 */
async function resolveWorker(workerId?: string): Promise<BoardWorker | null> {
  const worker = workerId
    ? await prisma.worker.findUnique({ where: { id: workerId } })
    : await prisma.worker.findFirst({
        where: { role: WorkerRole.WORKER },
        orderBy: { id: "asc" },
      });
  return worker ? { id: worker.id, name: worker.name } : null;
}

export async function getLog(
  options: { date?: string; workerId?: string; now?: Date } = {},
): Promise<LogView> {
  const date = options.date ?? todayInKst(options.now);
  const dateLabel = formatBoardDate(date);
  const worker = await resolveWorker(options.workerId);
  // 요청한 담당자를 못 찾았으면 남의 기록을 대신 보여주지 않는다
  const workerId = options.workerId ?? worker?.id ?? null;

  if (!workerId) {
    return { date, dateLabel, worker, items: [], groups: [] };
  }

  const rows = await prisma.checkEvent.findMany({
    where: { workerId },
    include: {
      subject: { select: { id: true, name: true } },
      alertDay: { select: { date: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const items = toLogItems(
    rows.map((row) => ({
      id: row.id,
      workerId: row.workerId,
      subjectId: row.subject.id,
      subjectName: row.subject.name,
      alertDate: row.alertDay.date,
      kind: row.kind,
      result: row.result,
      createdAt: row.createdAt,
    })),
    workerId,
  );

  return {
    date,
    dateLabel,
    worker,
    items,
    groups: groupLogItems(items),
  };
}
