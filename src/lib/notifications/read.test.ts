import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerRole } from "../domain";

const mocks = vi.hoisted(() => ({
  notificationFindMany: vi.fn(),
  workerFindFirst: vi.fn(),
}));

vi.mock("../db", () => ({
  prisma: {
    notification: { findMany: mocks.notificationFindMany },
    worker: { findFirst: mocks.workerFindFirst },
  },
}));

import { getManagerNotificationFeed } from "./read";

describe("getManagerNotificationFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workerFindFirst.mockResolvedValue(null);
  });

  it("현재 알림 피드는 활성 관리자만 기본 수신자로 선택한다", async () => {
    await expect(
      getManagerNotificationFeed({ date: "2026-08-23", now: new Date("2026-08-23T00:00:00.000Z") }),
    ).resolves.toEqual({ recipientId: null, items: [] });

    expect(mocks.workerFindFirst).toHaveBeenCalledWith({
      where: { role: WorkerRole.MANAGER, archivedAt: null },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    expect(mocks.notificationFindMany).not.toHaveBeenCalled();
  });
});
