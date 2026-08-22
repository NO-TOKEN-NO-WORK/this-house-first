import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlertLevel, WorkerRole } from "../domain";

const mocks = vi.hoisted(() => ({
  alertDayFindFirst: vi.fn(),
  householdDayStatusFindMany: vi.fn(),
  riskAssessmentFindMany: vi.fn(),
  subjectFindMany: vi.fn(),
  workerFindFirst: vi.fn(),
}));

vi.mock("../db", () => ({
  prisma: {
    alertDay: { findFirst: mocks.alertDayFindFirst },
    householdDayStatus: { findMany: mocks.householdDayStatusFindMany },
    riskAssessment: { findMany: mocks.riskAssessmentFindMany },
    subject: { findMany: mocks.subjectFindMany },
    worker: { findFirst: mocks.workerFindFirst },
  },
}));

import { getBoard } from "./today";

describe("getBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.alertDayFindFirst.mockResolvedValue(null);
    mocks.householdDayStatusFindMany.mockResolvedValue([]);
    mocks.riskAssessmentFindMany.mockResolvedValue([]);
    mocks.workerFindFirst.mockResolvedValue({ id: "worker-1", name: "박○○" });
    mocks.subjectFindMany.mockResolvedValue([]);
  });

  it("같은 날짜에 실제 경보와 데모가 있으면 데모 보드를 연다", async () => {
    mocks.alertDayFindFirst.mockResolvedValue({
      id: "demo-alert",
      isDemo: true,
      level: AlertLevel.EMERGENCY,
      feelsLikeMax: 38,
    });

    const board = await getBoard({ date: "2026-08-23" });

    expect(board).toMatchObject({
      alerted: true,
      isDemo: true,
      feelsLikeMax: 38,
    });
    expect(mocks.riskAssessmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ alertDayId: "demo-alert" }),
      }),
    );
    expect(mocks.alertDayFindFirst).toHaveBeenCalledWith({
      where: { date: "2026-08-23" },
      orderBy: { isDemo: "desc" },
    });
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

  it("보관된 담당자로 경보 보드를 요청해도 그 ID의 경보 스냅샷은 조회하지 않는다", async () => {
    mocks.alertDayFindFirst.mockResolvedValueOnce({
      id: "alert-1",
      level: AlertLevel.ADVISORY,
      feelsLikeMax: 33,
    });
    mocks.workerFindFirst.mockResolvedValueOnce(null);

    const board = await getBoard({
      date: "2026-08-23",
      workerId: "archived-worker",
    });

    expect(board).toMatchObject({
      alerted: true,
      worker: null,
      groups: [],
      summary: { total: 0 },
    });
    expect(mocks.riskAssessmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { alertDayId: "alert-1", subjectId: { in: [] } },
      }),
    );
  });
});
