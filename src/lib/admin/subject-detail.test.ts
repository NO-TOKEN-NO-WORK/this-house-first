import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerRole } from "../domain";

const mocks = vi.hoisted(() => ({
  buildingFindMany: vi.fn(),
  subjectFindUnique: vi.fn(),
  workerFindMany: vi.fn(),
}));

vi.mock("../db", () => ({
  prisma: {
    building: { findMany: mocks.buildingFindMany },
    subject: { findUnique: mocks.subjectFindUnique },
    worker: { findMany: mocks.workerFindMany },
  },
}));

import { getAdminSubjectDetail } from "./subject-detail";

describe("getAdminSubjectDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subjectFindUnique.mockResolvedValue(null);
    mocks.workerFindMany.mockResolvedValue([]);
    mocks.buildingFindMany.mockResolvedValue([]);
  });

  it("보관된 대상자의 과거 상세는 ID로 계속 조회하고 현재 배정 선택지만 활성 생활지원사로 제한한다", async () => {
    await expect(getAdminSubjectDetail("archived-subject", "2026-08-22")).resolves.toBeNull();

    expect(mocks.subjectFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "archived-subject" } }),
    );
    expect(mocks.workerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: WorkerRole.WORKER, archivedAt: null },
      }),
    );
  });
});
