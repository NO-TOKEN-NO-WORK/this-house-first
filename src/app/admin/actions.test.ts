import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerRole } from "../../lib/domain";

const mocks = vi.hoisted(() => ({
  checkDeleteMany: vi.fn(),
  checkCount: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  riskDeleteMany: vi.fn(),
  statusDeleteMany: vi.fn(),
  subjectCount: vi.fn(),
  subjectUpdate: vi.fn(),
  workerFindFirst: vi.fn(),
  workerUpdate: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    checkEvent: { count: mocks.checkCount, deleteMany: mocks.checkDeleteMany },
    householdDayStatus: { deleteMany: mocks.statusDeleteMany },
    riskAssessment: { deleteMany: mocks.riskDeleteMany },
    subject: { count: mocks.subjectCount, update: mocks.subjectUpdate },
    worker: { findFirst: mocks.workerFindFirst, update: mocks.workerUpdate },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import * as actions from "./actions";

const archiveSubject = (actions as typeof actions & {
  archiveSubject: (subjectId: string) => Promise<void>;
}).archiveSubject;
const archiveWorker = (actions as typeof actions & {
  archiveWorker: (workerId: string) => Promise<void>;
}).archiveWorker;

describe("관리자 원장 보관 액션", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subjectUpdate.mockResolvedValue({ id: "subject-1" });
    mocks.workerFindFirst.mockResolvedValue({ id: "worker-1" });
    mocks.subjectCount.mockResolvedValue(0);
    mocks.workerUpdate.mockResolvedValue({ id: "worker-1" });
  });

  it("대상자를 보관하고 과거 경보·점검 이력은 삭제하지 않는다", async () => {
    await archiveSubject("subject-1");

    expect(mocks.subjectUpdate).toHaveBeenCalledWith({
      where: { id: "subject-1", archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    });
    expect(mocks.riskDeleteMany).not.toHaveBeenCalled();
    expect(mocks.statusDeleteMany).not.toHaveBeenCalled();
    expect(mocks.checkDeleteMany).not.toHaveBeenCalled();
  });

  it("이미 보관됐거나 없는 대상자는 명확한 오류를 반환한다", async () => {
    mocks.subjectUpdate.mockRejectedValueOnce({ code: "P2025" });

    await expect(archiveSubject("missing-subject")).rejects.toThrow(
      "대상자를 찾을 수 없거나 이미 보관되었습니다.",
    );
  });

  it("활성 대상자가 배정된 생활지원사의 보관을 거부한다", async () => {
    mocks.subjectCount.mockResolvedValueOnce(1);

    await expect(archiveWorker("worker-1")).rejects.toThrow(
      "활성 대상자가 배정된 생활지원사는 보관할 수 없습니다.",
    );
    expect(mocks.workerFindFirst).toHaveBeenCalledWith({
      where: { id: "worker-1", role: WorkerRole.WORKER, archivedAt: null },
    });
    expect(mocks.subjectCount).toHaveBeenCalledWith({
      where: { workerId: "worker-1", archivedAt: null },
    });
    expect(mocks.workerUpdate).not.toHaveBeenCalled();
  });

  it("활성 대상자가 없으면 과거 점검 이력이 있어도 생활지원사를 보관한다", async () => {
    await archiveWorker("worker-1");

    expect(mocks.workerUpdate).toHaveBeenCalledWith({
      where: { id: "worker-1", archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    });
    expect(mocks.checkCount).not.toHaveBeenCalled();
  });
});
