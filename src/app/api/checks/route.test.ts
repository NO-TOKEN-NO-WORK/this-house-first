import { beforeEach, describe, expect, it, vi } from "vitest";
import { CallResult, CheckKind, HouseholdStatus } from "@/lib/domain";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { $transaction: mocks.transaction },
}));
vi.mock("@/lib/notifications/push", () => ({
  dispatchDueNotifications: vi.fn(),
}));

import { POST } from "./route";

function request(workerId?: string): Request {
  return new Request("http://localhost/api/checks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subjectId: "subject-1",
      kind: CheckKind.CALL,
      result: CallResult.OK,
      date: "2026-08-23",
      ...(workerId ? { workerId } : {}),
    }),
  });
}

describe("POST /api/checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("보관된 대상자 또는 배정 담당자의 경보 상태에는 새 확인 기록을 거절한다", async () => {
    const householdFindUnique = vi.fn()
      .mockResolvedValueOnce({ id: "alert-1" })
      .mockResolvedValueOnce({
        id: "status-1",
        status: HouseholdStatus.UNCHECKED,
        callAttempts: 0,
        updatedAt: new Date("2026-08-23T00:00:00.000Z"),
        subject: {
          name: "김○○",
          workerId: "worker-1",
          archivedAt: new Date("2026-08-22T15:00:00.000Z"),
          worker: { archivedAt: null },
        },
      });
    const tx = {
      alertDay: { findUnique: householdFindUnique },
      householdDayStatus: { findUnique: householdFindUnique },
      worker: { findUnique: vi.fn() },
    };
    mocks.transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ARCHIVED_ROSTER",
        message: "보관된 대상자 또는 담당자는 확인을 기록할 수 없습니다.",
      },
    });
    expect(tx.householdDayStatus.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({
        include: {
          subject: {
            select: {
              name: true,
              workerId: true,
              archivedAt: true,
              worker: { select: { archivedAt: true } },
            },
          },
        },
      }),
    );
    expect(tx.worker.findUnique).not.toHaveBeenCalled();
  });

  it("명시한 기록 담당자가 보관된 경우에도 새 확인 기록을 거절한다", async () => {
    const tx = {
      alertDay: { findUnique: vi.fn().mockResolvedValue({ id: "alert-1" }) },
      householdDayStatus: {
        findUnique: vi.fn().mockResolvedValue({
          id: "status-1",
          status: HouseholdStatus.UNCHECKED,
          callAttempts: 0,
          updatedAt: new Date("2026-08-23T00:00:00.000Z"),
          subject: {
            name: "김○○",
            workerId: "worker-1",
            archivedAt: null,
            worker: { archivedAt: null },
          },
        }),
      },
      worker: {
        findUnique: vi.fn().mockResolvedValue({
          id: "archived-recorder",
          archivedAt: new Date("2026-08-22T15:00:00.000Z"),
        }),
      },
    };
    mocks.transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const response = await POST(request("archived-recorder"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ARCHIVED_ROSTER" },
    });
    expect(tx.worker.findUnique).toHaveBeenCalledWith({
      where: { id: "archived-recorder" },
      select: { id: true, archivedAt: true },
    });
  });
});
