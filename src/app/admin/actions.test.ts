import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerRole } from "../../lib/domain";

const mocks = vi.hoisted(() => ({
  checkDeleteMany: vi.fn(),
  checkCount: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  riskDeleteMany: vi.fn(),
  rootSubjectCreate: vi.fn(),
  rootSubjectUpdate: vi.fn(),
  rootWorkerCreate: vi.fn(),
  rootWorkerFindFirst: vi.fn(),
  rootWorkerUpdate: vi.fn(),
  statusDeleteMany: vi.fn(),
  transaction: vi.fn(),
  txSubjectCount: vi.fn(),
  txSubjectCreate: vi.fn(),
  txSubjectUpdate: vi.fn(),
  txWorkerFindFirst: vi.fn(),
  txWorkerUpdate: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    checkEvent: { count: mocks.checkCount, deleteMany: mocks.checkDeleteMany },
    householdDayStatus: { deleteMany: mocks.statusDeleteMany },
    riskAssessment: { deleteMany: mocks.riskDeleteMany },
    subject: {
      create: mocks.rootSubjectCreate,
      update: mocks.rootSubjectUpdate,
    },
    worker: {
      create: mocks.rootWorkerCreate,
      findFirst: mocks.rootWorkerFindFirst,
      update: mocks.rootWorkerUpdate,
    },
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

const transactionClient = {
  subject: {
    count: mocks.txSubjectCount,
    create: mocks.txSubjectCreate,
    update: mocks.txSubjectUpdate,
  },
  worker: {
    findFirst: mocks.txWorkerFindFirst,
    update: mocks.txWorkerUpdate,
  },
};

function validSubjectForm(workerId = "worker-1") {
  const form = new FormData();
  form.set("name", "김○○");
  form.set("birthYear", "1950");
  form.set("workerId", workerId);
  form.set("buildingId", "building-1");
  return form;
}

describe("관리자 원장 보관 액션", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );
    mocks.rootSubjectUpdate.mockResolvedValue({ id: "subject-1" });
    mocks.txSubjectCreate.mockResolvedValue({ id: "subject-1" });
    mocks.txSubjectUpdate.mockResolvedValue({ id: "subject-1" });
    mocks.txWorkerFindFirst.mockResolvedValue({ id: "worker-1" });
    mocks.txSubjectCount.mockResolvedValue(0);
    mocks.txWorkerUpdate.mockResolvedValue({ id: "worker-1" });
  });

  it("대상자 생성은 활성 생활지원사 확인과 쓰기를 직렬화 트랜잭션에서 처리한다", async () => {
    await actions.createSubject(validSubjectForm());

    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(mocks.txWorkerFindFirst).toHaveBeenCalledWith({
      where: { id: "worker-1", role: WorkerRole.WORKER, archivedAt: null },
      select: { id: true },
    });
    expect(mocks.txSubjectCreate).toHaveBeenCalledOnce();
    expect(mocks.rootSubjectCreate).not.toHaveBeenCalled();
  });

  it("대상자 생성은 보관됐거나 없는 담당자 배정을 거부한다", async () => {
    mocks.txWorkerFindFirst.mockResolvedValueOnce(null);

    await expect(actions.createSubject(validSubjectForm("archived-worker"))).rejects.toThrow(
      "활성 생활지원사를 찾을 수 없습니다.",
    );
    expect(mocks.txWorkerFindFirst).toHaveBeenCalledWith({
      where: {
        id: "archived-worker",
        role: WorkerRole.WORKER,
        archivedAt: null,
      },
      select: { id: true },
    });
    expect(mocks.txSubjectCreate).not.toHaveBeenCalled();
  });

  it("대상자 수정은 보관됐거나 없는 담당자 재배정을 거부한다", async () => {
    mocks.txWorkerFindFirst.mockResolvedValueOnce(null);

    await expect(
      actions.updateSubject("subject-1", validSubjectForm("archived-worker")),
    ).rejects.toThrow("활성 생활지원사를 찾을 수 없습니다.");
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(mocks.txWorkerFindFirst).toHaveBeenCalledWith({
      where: {
        id: "archived-worker",
        role: WorkerRole.WORKER,
        archivedAt: null,
      },
      select: { id: true },
    });
    expect(mocks.txSubjectUpdate).not.toHaveBeenCalled();
    expect(mocks.rootSubjectUpdate).not.toHaveBeenCalled();
  });

  it("대상자 수정은 활성 생활지원사 확인과 쓰기를 같은 직렬화 트랜잭션에서 처리한다", async () => {
    await actions.updateSubject("subject-1", validSubjectForm());

    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(mocks.txWorkerFindFirst).toHaveBeenCalledOnce();
    expect(mocks.txSubjectUpdate).toHaveBeenCalledWith({
      where: { id: "subject-1" },
      data: expect.objectContaining({ workerId: "worker-1" }),
    });
    expect(mocks.rootSubjectUpdate).not.toHaveBeenCalled();
  });

  it("대상자를 보관하고 과거 경보·점검 이력은 삭제하지 않는다", async () => {
    await archiveSubject("subject-1");

    expect(mocks.rootSubjectUpdate).toHaveBeenCalledWith({
      where: { id: "subject-1", archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    });
    expect(mocks.riskDeleteMany).not.toHaveBeenCalled();
    expect(mocks.statusDeleteMany).not.toHaveBeenCalled();
    expect(mocks.checkDeleteMany).not.toHaveBeenCalled();
  });

  it("이미 보관됐거나 없는 대상자는 명확한 오류를 반환한다", async () => {
    mocks.rootSubjectUpdate.mockRejectedValueOnce({ code: "P2025" });

    await expect(archiveSubject("missing-subject")).rejects.toThrow(
      "대상자를 찾을 수 없거나 이미 보관되었습니다.",
    );
  });

  it("활성 대상자가 배정된 생활지원사의 보관을 거부한다", async () => {
    mocks.txSubjectCount.mockResolvedValueOnce(1);

    await expect(archiveWorker("worker-1")).rejects.toThrow(
      "활성 대상자가 배정된 생활지원사는 보관할 수 없습니다.",
    );
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(mocks.txWorkerFindFirst).toHaveBeenCalledWith({
      where: { id: "worker-1", role: WorkerRole.WORKER, archivedAt: null },
    });
    expect(mocks.txSubjectCount).toHaveBeenCalledWith({
      where: { workerId: "worker-1", archivedAt: null },
    });
    expect(mocks.txWorkerUpdate).not.toHaveBeenCalled();
    expect(mocks.rootWorkerFindFirst).not.toHaveBeenCalled();
    expect(mocks.rootWorkerUpdate).not.toHaveBeenCalled();
  });

  it("활성 대상자가 없으면 과거 점검 이력이 있어도 생활지원사를 보관한다", async () => {
    await archiveWorker("worker-1");

    expect(mocks.txWorkerUpdate).toHaveBeenCalledWith({
      where: { id: "worker-1", archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    });
    expect(mocks.checkCount).not.toHaveBeenCalled();
  });
});
