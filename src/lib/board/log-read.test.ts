import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerRole } from "../domain";

const mocks = vi.hoisted(() => ({
  checkEventFindMany: vi.fn(),
  workerFindFirst: vi.fn(),
  workerFindUnique: vi.fn(),
}));

vi.mock("../db", () => ({
  prisma: {
    checkEvent: { findMany: mocks.checkEventFindMany },
    worker: {
      findFirst: mocks.workerFindFirst,
      findUnique: mocks.workerFindUnique,
    },
  },
}));

import { getLog } from "./log-read";

describe("getLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkEventFindMany.mockResolvedValue([]);
    mocks.workerFindFirst.mockResolvedValue({ id: "worker-1", name: "박○○" });
  });

  it("기본 확인 기록은 활성 생활지원사를 선택한다", async () => {
    const log = await getLog({ date: "2026-08-23" });

    expect(log.worker).toEqual({ id: "worker-1", name: "박○○" });
    expect(mocks.workerFindFirst).toHaveBeenCalledWith({
      where: { role: WorkerRole.WORKER, archivedAt: null },
      orderBy: { id: "asc" },
    });
  });
});
