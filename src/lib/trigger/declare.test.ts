import type { PrismaClient } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  AlertLevel,
  HouseholdStatus,
  NotificationType,
  WorkerRole,
} from "../domain";
import { declareTrigger, resetDemoTrigger } from "./declare";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ prisma: {} }));

describe("declareTrigger", () => {
  it("기존 실제 경보일과 별도로 데모 경보를 만든다", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "demo-alert" });
    const riskAssessmentUpsert = vi.fn().mockResolvedValue({});
    const tx = {
      alertDay: {
        upsert,
      },
      worker: { findMany: vi.fn().mockResolvedValue([]) },
      riskAssessment: { upsert: riskAssessmentUpsert },
      householdDayStatus: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      notification: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const client = {
      subject: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "subject-1",
            name: "김○○",
            birthYear: 1940,
            livesAlone: true,
            hasMobilityIssue: false,
            hasChronicDisease: false,
            airconBroken: false,
            workerId: "worker-1",
            building: {
              isDetached: true,
              builtYear: 1970,
              structure: "벽돌",
              hasTopFloorUnit: false,
            },
          },
        ]),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      declareTrigger(
        { targetDate: "20260822", feelsLikeMax: 38, demo: true },
        { client },
      ),
    ).resolves.toMatchObject({ alerted: true, alertDayId: "demo-alert" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date_isDemo: { date: "2026-08-22", isDemo: true },
        },
      }),
    );
    expect(riskAssessmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ alertDayId: "demo-alert" }),
      }),
    );
  });

  it("데모 발령은 경보일에 데모 표시를 저장한다", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "alert-1" });
    const tx = {
      alertDay: { findUnique: vi.fn().mockResolvedValue(null), upsert },
      worker: { findMany: vi.fn().mockResolvedValue([]) },
      riskAssessment: { upsert: vi.fn().mockResolvedValue({}) },
      householdDayStatus: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      notification: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const client = {
      subject: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "subject-1",
            name: "김○○",
            birthYear: 1940,
            livesAlone: true,
            hasMobilityIssue: false,
            hasChronicDisease: false,
            airconBroken: false,
            workerId: "worker-1",
            building: {
              isDetached: true,
              builtYear: 1970,
              structure: "벽돌",
              hasTopFloorUnit: false,
            },
          },
        ]),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    await declareTrigger(
      {
        targetDate: "20260822",
        feelsLikeMax: 38,
        demo: true,
      },
      { client, now: new Date("2026-08-22T01:00:00.000Z") },
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isDemo: true }),
        update: expect.objectContaining({ isDemo: true }),
      }),
    );
    expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      timeout: 15_000,
    });
  });

  it("관제 센터 수동 재발령은 같은 날의 담당자 요약 Push를 다시 보낼 수 있게 연다", async () => {
    const notificationUpsert = vi.fn().mockResolvedValue({});
    const tx = {
      alertDay: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: "alert-1" }),
      },
      worker: { findMany: vi.fn().mockResolvedValue([]) },
      riskAssessment: { upsert: vi.fn().mockResolvedValue({}) },
      householdDayStatus: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      notification: { upsert: notificationUpsert },
    };
    const client = {
      subject: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "subject-1",
            name: "김○○",
            birthYear: 1940,
            livesAlone: true,
            hasMobilityIssue: false,
            hasChronicDisease: false,
            airconBroken: false,
            workerId: "worker-1",
            building: {
              isDetached: true,
              builtYear: 1970,
              structure: "벽돌",
              hasTopFloorUnit: false,
            },
          },
        ]),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    await declareTrigger(
      { targetDate: "20260822", level: AlertLevel.EMERGENCY },
      { client, now: new Date("2026-08-22T01:00:00.000Z") },
    );

    const summaryCall = notificationUpsert.mock.calls.find(
      ([input]) => input.create.type === NotificationType.ALERT_DAY_SUMMARY,
    );
    expect(summaryCall?.[0].update).toMatchObject({
      pushClaimedAt: null,
      pushSentAt: null,
      pushAttempts: 0,
      lastPushError: null,
    });
  });

  it("새 경보는 활성 대상자·활성 담당자에게만 평가와 알림을 만든다", async () => {
    const subjectFindMany = vi.fn().mockResolvedValue([
      {
        id: "subject-1",
        name: "김○○",
        workerId: "worker-1",
        birthYear: 1938,
        livesAlone: true,
        hasMobilityIssue: null,
        hasChronicDisease: null,
        airconBroken: false,
        building: {
          isDetached: false,
          builtYear: null,
          structure: null,
          hasTopFloorUnit: false,
        },
      },
    ]);
    const workerFindMany = vi.fn().mockResolvedValue([]);
    const tx = {
      alertDay: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: "alert-1" }),
      },
      worker: { findMany: workerFindMany },
      riskAssessment: { upsert: vi.fn().mockResolvedValue({}) },
      householdDayStatus: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      notification: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const client = {
      subject: { findMany: subjectFindMany },
      $transaction: async (
        callback: (transaction: typeof tx) => Promise<unknown>,
      ) => callback(tx),
    } as unknown as PrismaClient;

    await declareTrigger(
      {
        targetDate: "20260823",
        level: AlertLevel.WARNING,
        feelsLikeMax: 36,
      },
      { client, now: new Date("2026-08-22T15:00:00.000Z") },
    );

    expect(subjectFindMany).toHaveBeenCalledWith({
      where: { archivedAt: null, worker: { archivedAt: null } },
      include: { building: true },
      orderBy: { id: "asc" },
    });
    expect(workerFindMany).toHaveBeenCalledWith({
      where: { role: WorkerRole.MANAGER, archivedAt: null },
      select: { id: true },
    });
    expect(tx.householdDayStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: HouseholdStatus.UNCHECKED }),
      }),
    );
  });
});

describe("resetDemoTrigger", () => {
  it("직렬화 충돌은 최대 세 번 안에서 다시 시도한다", async () => {
    const tx = {
      alertDay: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const client = {
      $transaction: vi
        .fn()
        .mockRejectedValueOnce({ code: "P2034" })
        .mockImplementationOnce(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      resetDemoTrigger("20260822", { client }),
    ).resolves.toEqual({ reset: false, targetDate: "2026-08-22" });
    expect(client.$transaction).toHaveBeenCalledTimes(2);
    expect(client.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      timeout: 15_000,
    });
  });

  it("PostgreSQL 데드락도 직렬화 충돌처럼 다시 시도한다", async () => {
    const tx = {
      alertDay: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const deadlock = {
      code: "P2039",
      meta: {
        driverAdapterError: {
          cause: { code: "40P01", originalCode: "40P01" },
        },
      },
    };
    const client = {
      $transaction: vi
        .fn()
        .mockRejectedValueOnce(deadlock)
        .mockImplementationOnce(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      resetDemoTrigger("20260822", { client }),
    ).resolves.toEqual({ reset: false, targetDate: "2026-08-22" });
    expect(client.$transaction).toHaveBeenCalledTimes(2);
  });

  it("직렬화 충돌이 세 번 이어지면 숨기지 않고 반환한다", async () => {
    const conflict = { code: "P2034" };
    const client = {
      $transaction: vi.fn().mockRejectedValue(conflict),
    } as unknown as PrismaClient;

    await expect(
      resetDemoTrigger("20260822", { client }),
    ).rejects.toBe(conflict);
    expect(client.$transaction).toHaveBeenCalledTimes(3);
  });

  it("이미 꺼진 날짜는 삭제 없이 같은 평상시 결과를 반환한다", async () => {
    const tx = {
      alertDay: { findUnique: vi.fn().mockResolvedValue(null), delete: vi.fn() },
      notification: { deleteMany: vi.fn() },
      checkEvent: { deleteMany: vi.fn() },
      householdDayStatus: { deleteMany: vi.fn() },
      riskAssessment: { deleteMany: vi.fn() },
    };
    const client = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      resetDemoTrigger("20260822", { client }),
    ).resolves.toEqual({ reset: false, targetDate: "2026-08-22" });
    expect(tx.alertDay.delete).not.toHaveBeenCalled();
  });

  it("데모 경보의 기록과 경보일을 한 트랜잭션에서 초기화한다", async () => {
    const tx = {
      alertDay: {
        findUnique: vi.fn().mockResolvedValue({ id: "alert-1", isDemo: true }),
        delete: vi.fn().mockResolvedValue({}),
      },
      notification: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      checkEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      householdDayStatus: { deleteMany: vi.fn().mockResolvedValue({ count: 15 }) },
      riskAssessment: { deleteMany: vi.fn().mockResolvedValue({ count: 15 }) },
    };
    const client = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      resetDemoTrigger("20260822", { client }),
    ).resolves.toEqual({ reset: true, targetDate: "2026-08-22" });
    expect(tx.checkEvent.deleteMany).toHaveBeenCalledWith({
      where: { alertDayId: "alert-1" },
    });
    expect(tx.alertDay.delete).toHaveBeenCalledWith({
      where: { id: "alert-1" },
    });
  });

  it("데모 종료 시 같은 날짜의 실제 경보와 기록은 남긴다", async () => {
    const deleteAlertDay = vi.fn().mockResolvedValue({});
    const tx = {
      alertDay: {
        findUnique: vi.fn().mockImplementation(({ where }) =>
          where.date_isDemo
            ? Promise.resolve({ id: "demo-alert", isDemo: true })
            : Promise.resolve({ id: "real-alert", isDemo: false }),
        ),
        delete: deleteAlertDay,
      },
      notification: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      checkEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      householdDayStatus: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      riskAssessment: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const client = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      resetDemoTrigger("20260822", { client }),
    ).resolves.toEqual({ reset: true, targetDate: "2026-08-22" });
    expect(deleteAlertDay).toHaveBeenCalledWith({
      where: { id: "demo-alert" },
    });
    expect(deleteAlertDay).not.toHaveBeenCalledWith({
      where: { id: "real-alert" },
    });
  });
});
