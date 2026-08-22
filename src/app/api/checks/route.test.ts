import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CallResult,
  CheckKind,
  CoolingStatus,
  HouseholdStatus,
} from "@/lib/domain";

const mocks = vi.hoisted(() => ({
  dispatchDueNotifications: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { $transaction: mocks.transaction },
}));
vi.mock("@/lib/notifications/push", () => ({
  dispatchDueNotifications: mocks.dispatchDueNotifications,
}));

import { POST } from "./route";

function request(
  workerId?: string,
  overrides: Record<string, unknown> = {},
): Request {
  return new Request("http://localhost/api/checks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subjectId: "subject-1",
      kind: CheckKind.CALL,
      result: CallResult.OK,
      date: "2026-08-23",
      ...(workerId ? { workerId } : {}),
      ...overrides,
    }),
  });
}

function successfulTransaction(isDemo: boolean) {
  const tx = {
    alertDay: {
      findFirst: vi.fn().mockResolvedValue({ id: "demo-alert", isDemo }),
    },
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
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    checkEvent: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    subject: { update: vi.fn().mockResolvedValue({}) },
    worker: {
      findUnique: vi.fn().mockResolvedValue({
        id: "worker-1",
        archivedAt: null,
      }),
      findMany: vi.fn().mockResolvedValue([{ id: "manager-1" }]),
    },
  };
  mocks.transaction.mockImplementation(
    async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  );
  return tx;
}

describe("POST /api/checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dispatchDueNotifications.mockResolvedValue(null);
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
      alertDay: { findFirst: householdFindUnique },
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
      alertDay: { findFirst: vi.fn().mockResolvedValue({ id: "alert-1" }) },
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

  it("데모 중 확인 기록은 실제 경보가 아니라 데모 경보에 남긴다", async () => {
    const alertDayFindFirst = vi.fn().mockResolvedValue({ id: "demo-alert" });
    const statusFindUnique = vi.fn().mockResolvedValue(null);
    const tx = {
      alertDay: {
        findFirst: alertDayFindFirst,
      },
      householdDayStatus: { findUnique: statusFindUnique },
    };
    mocks.transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(statusFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          alertDayId_subjectId: {
            alertDayId: "demo-alert",
            subjectId: "subject-1",
          },
        },
      }),
    );
  });

  it("데모 확인은 공용 대상자 냉방 상태를 바꾸지 않는다", async () => {
    const tx = successfulTransaction(true);

    const response = await POST(
      request(undefined, { coolingStatus: CoolingStatus.NEEDS_CHECK }),
    );

    expect(response.status).toBe(200);
    expect(tx.subject.update).not.toHaveBeenCalled();
  });

  it("데모 승격 Push는 데모 경보의 알림만 발송한다", async () => {
    successfulTransaction(true);

    const response = await POST(
      request(undefined, { result: CallResult.SYMPTOM }),
    );

    expect(response.status).toBe(200);
    expect(mocks.dispatchDueNotifications).toHaveBeenCalledWith({
      alertDayId: "demo-alert",
    });
  });
});
