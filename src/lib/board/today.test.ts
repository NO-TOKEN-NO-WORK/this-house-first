import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerRole } from "../domain";

const mocks = vi.hoisted(() => ({
  alertDayFindUnique: vi.fn(),
  subjectFindMany: vi.fn(),
  workerFindFirst: vi.fn(),
}));

vi.mock("../db", () => ({
  prisma: {
    alertDay: { findUnique: mocks.alertDayFindUnique },
    subject: { findMany: mocks.subjectFindMany },
    worker: { findFirst: mocks.workerFindFirst },
  },
}));

import { getBoard } from "./today";

describe("getBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.alertDayFindUnique.mockResolvedValue(null);
    mocks.workerFindFirst.mockResolvedValue({ id: "worker-1", name: "박○○" });
    mocks.subjectFindMany.mockResolvedValue([]);
  });

  it("비경보일 현재 명단은 활성 생활지원사와 활성 대상자만 조회한다", async () => {
    const board = await getBoard({ date: "2026-08-23" });

    expect(board).toMatchObject({ alerted: false, worker: { id: "worker-1" } });
    expect(mocks.workerFindFirst).toHaveBeenCalledWith({
      where: { role: WorkerRole.WORKER, archivedAt: null },
      orderBy: { id: "asc" },
    });
    expect(mocks.subjectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workerId: "worker-1",
          archivedAt: null,
          worker: { archivedAt: null },
        },
      }),
    );
  });

  it("보관된 담당자를 명시해도 현재 명단을 열지 않는다", async () => {
    mocks.workerFindFirst.mockResolvedValueOnce(null);

    const board = await getBoard({ date: "2026-08-23", workerId: "archived-worker" });

    expect(board).toMatchObject({ alerted: false, worker: null, subjects: [] });
    expect(mocks.workerFindFirst).toHaveBeenCalledWith({
      where: { id: "archived-worker", role: WorkerRole.WORKER, archivedAt: null },
      orderBy: { id: "asc" },
    });
  });
});
