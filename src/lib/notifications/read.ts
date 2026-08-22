import { prisma } from "../db";
import { NotificationType, WorkerRole } from "../domain";
import { todayInKst } from "../board/today";

export interface NotificationFeedItem {
  id: string;
  title: string;
  body: string;
  href: string;
  availableAt: string;
}

export interface ManagerNotificationFeed {
  recipientId: string | null;
  items: NotificationFeedItem[];
}

/** 관리자 인앱 승격 피드 — 비경보일에는 Notification 행이 없으므로 자연스럽게 빈 목록이다. */
export async function getManagerNotificationFeed(
  options: {
    date?: string;
    workerId?: string;
    now?: Date;
  } = {},
): Promise<ManagerNotificationFeed> {
  const now = options.now ?? new Date();
  const date = options.date ?? todayInKst(now);
  const manager = await prisma.worker.findFirst({
    where: { role: WorkerRole.MANAGER, archivedAt: null },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!manager) return { recipientId: null, items: [] };

  const rows = await prisma.notification.findMany({
    where: {
      recipientId: manager.id,
      type: NotificationType.VISIT_PROMOTED,
      availableAt: { lte: now },
      alertDay: { date },
      ...(options.workerId
        ? { subject: { is: { workerId: options.workerId } } }
        : {}),
    },
    orderBy: [{ availableAt: "desc" }, { id: "desc" }],
    take: 20,
  });

  return {
    recipientId: manager.id,
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      href: row.href,
      availableAt: row.availableAt.toISOString(),
    })),
  };
}
