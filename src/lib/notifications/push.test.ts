import type { PrismaClient } from "@/generated/prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationType } from "../domain";

const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ prisma: {} }));
vi.mock("web-push", () => ({
  default: { sendNotification },
  WebPushError: class WebPushError extends Error {},
}));

import { dispatchDueNotifications } from "./push";

describe("dispatchDueNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public";
    process.env.VAPID_PRIVATE_KEY = "private";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  it("여러 기기 중 일부만 실패하면 부분 실패로 집계한다", async () => {
    const now = new Date("2026-08-22T01:00:00.000Z");
    const notification = {
      id: "notification-1",
      eventKey: "ALERT_DAY_SUMMARY:alert-1:worker-1",
      type: NotificationType.ALERT_DAY_SUMMARY,
      title: "오늘은 폭염 심각 단계입니다",
      body: "2명은 오늘 확인이 필요합니다.",
      href: "/today?date=2026-08-22&workerId=worker-1",
      expiresAt: new Date("2026-08-22T14:59:59.999Z"),
      recipient: {
        pushSubscriptions: [
          { id: "subscription-1", endpoint: "https://push.test/1", p256dh: "p1", auth: "a1" },
          { id: "subscription-2", endpoint: "https://push.test/2", p256dh: "p2", auth: "a2" },
        ],
      },
    };
    const client = {
      notification: {
        findMany: vi.fn().mockResolvedValue([notification]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue(notification),
      },
      pushSubscription: { deleteMany: vi.fn() },
    } as unknown as PrismaClient;
    sendNotification
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("push unavailable"));

    const result = await dispatchDueNotifications({ now }, client);

    expect(result).toEqual({
      configured: true,
      claimed: 1,
      sent: 1,
      failed: 0,
      partialFailures: 1,
    });
  });
});
