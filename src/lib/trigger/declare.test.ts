import type { PrismaClient } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AlertLevel, NotificationType } from "../domain";
import { declareTrigger } from "./declare";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ prisma: {} }));

describe("declareTrigger", () => {
  it("관제 센터 수동 재발령은 같은 날의 담당자 요약 Push를 다시 보낼 수 있게 연다", async () => {
    const notificationUpsert = vi.fn().mockResolvedValue({});
    const tx = {
      alertDay: {
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
});
