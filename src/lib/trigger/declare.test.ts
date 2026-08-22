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
  it("기존 실제 경보일은 데모 발령으로 덮어쓰지 않는다", async () => {
    const upsert = vi.fn();
    const tx = {
      alertDay: {
        findUnique: vi.fn().mockResolvedValue({ id: "alert-1", isDemo: false }),
        upsert: upsert.mockResolvedValue({ id: "alert-1" }),
      },
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

    await expect(
      declareTrigger(
        { targetDate: "20260822", feelsLikeMax: 38, demo: true },
        { client },
      ),
    ).rejects.toMatchObject({ code: "DEMO_CONFLICT", status: 409 });
    expect(upsert).not.toHaveBeenCalled();
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
      alertDay: { upsert: vi.fn().mockResolvedValue({ id: "alert-1" }) },
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

  it("실제 경보일은 어떤 기록도 지우지 않고 거부한다", async () => {
    const tx = {
      alertDay: {
        findUnique: vi.fn().mockResolvedValue({ id: "alert-1", isDemo: false }),
        delete: vi.fn(),
      },
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
    ).rejects.toMatchObject({ code: "NOT_DEMO_ALERT", status: 409 });
    expect(tx.alertDay.delete).not.toHaveBeenCalled();
    expect(tx.checkEvent.deleteMany).not.toHaveBeenCalled();
  });
});
