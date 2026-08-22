import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlertLevel } from "@/lib/domain";

const mocks = vi.hoisted(() => ({
  declareTrigger: vi.fn(),
  dispatchDueNotifications: vi.fn(),
}));

vi.mock("@/lib/trigger/declare", () => ({
  declareTrigger: mocks.declareTrigger,
  TriggerError: class TriggerError extends Error {
    constructor(
      message: string,
      readonly code: string,
      readonly status = 400,
    ) {
      super(message);
    }
  },
}));

vi.mock("@/lib/notifications/push", () => ({
  dispatchDueNotifications: mocks.dispatchDueNotifications,
}));

import { POST } from "./route";

const outcome = {
  alerted: true,
  source: "manual",
  targetDate: "2026-08-22",
  alertDayId: "alert-1",
  level: AlertLevel.EMERGENCY,
  feelsLikeMax: 38,
  subjectCount: 15,
  gradeCounts: { 1: 2, 2: 5, 3: 8 },
  visitQueued: 2,
  preserved: 0,
};

function request(): Request {
  return new Request("http://localhost/api/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetDate: "20260822", level: AlertLevel.EMERGENCY }),
  });
}

describe("POST /api/trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.declareTrigger.mockResolvedValue(outcome);
  });

  it("발령 결과와 Push 발송 결과를 함께 반환한다", async () => {
    const push = { configured: true, claimed: 2, sent: 2, failed: 0 };
    mocks.dispatchDueNotifications.mockResolvedValue(push);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: outcome, push });
  });

  it("Push 호출이 실패해도 완료된 경보 발령과 실패 상태를 반환한다", async () => {
    mocks.dispatchDueNotifications.mockRejectedValue(new Error("push unavailable"));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: outcome, push: null });
  });
});
