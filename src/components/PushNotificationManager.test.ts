import { describe, expect, it, vi } from "vitest";
import * as pushNotifications from "./PushNotificationManager";

describe("renewPushSubscription", () => {
  it("브라우저에 남은 기존 endpoint는 해지하지 않고 서버에 다시 저장할 수 있게 재사용한다", async () => {
    const calls: string[] = [];
    const existing = { endpoint: "https://push.example.com/existing" } as PushSubscription;
    const pushManager = {
      getSubscription: async () => {
        calls.push("get");
        return existing;
      },
      subscribe: async () => {
        calls.push("subscribe");
        return existing;
      },
    };
    await expect(
      pushNotifications.renewPushSubscription(
        pushManager,
        new Uint8Array([1, 2, 3]),
      ),
    ).resolves.toEqual({ subscription: existing, created: false });
    expect(calls).toEqual(["get"]);
  });
});

describe("iOS PWA 구독 준비", () => {
  it("데스크톱 UA와 터치 화면을 쓰는 iPadOS도 iOS 기기로 판별한다", () => {
    expect(
      pushNotifications.isIosDevice({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("기존 브라우저 구독의 서버 저장이 일시 실패해도 구독을 해지하지 않는다", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const existing = {
      endpoint: "https://push.example.com/existing",
      toJSON: () => ({ keys: { p256dh: "p", auth: "a" } }),
      unsubscribe,
    } as unknown as PushSubscription;
    const registered = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(existing),
        subscribe: vi.fn(),
      },
    } as unknown as ServiceWorkerRegistration;
    const originalWindow = globalThis.window;
    vi.stubGlobal("window", { atob: () => "key" });

    await expect(
      pushNotifications.createSubscription(
        registered,
        "worker-1",
        "a2V5",
        vi.fn().mockRejectedValue(new Error("network unavailable")),
      ),
    ).rejects.toThrow();
    expect(unsubscribe).not.toHaveBeenCalled();

    vi.stubGlobal("window", originalWindow);
  });
});
