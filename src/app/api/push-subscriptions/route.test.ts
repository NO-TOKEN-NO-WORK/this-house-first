import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  dispatchDueNotifications: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    pushSubscription: {
      count: mocks.count,
      upsert: mocks.upsert,
    },
    worker: { findUnique: mocks.findUnique },
  },
}));

vi.mock("@/lib/notifications/push", () => ({
  dispatchDueNotifications: mocks.dispatchDueNotifications,
}));

import { POST } from "./route";

describe("POST /api/push-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({ id: "worker-1" });
    mocks.upsert.mockResolvedValue({});
    mocks.dispatchDueNotifications.mockResolvedValue({
      configured: true,
      claimed: 1,
      sent: 0,
      failed: 1,
      partialFailures: 0,
    });
  });

  it("구독 직후 발송기가 endpoint를 삭제하면 구독 실패를 반환한다", async () => {
    mocks.count.mockResolvedValue(0);

    const response = await POST(
      new Request("https://example.com/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: "worker-1",
          endpoint: "https://push.example.com/subscription-1",
          keys: { p256dh: "p256dh", auth: "auth" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { subscribed: false },
    });
  });
});
