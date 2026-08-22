import { describe, expect, it } from "vitest";
import * as pushNotifications from "./PushNotificationManager";

type RenewPushSubscription = (
  pushManager: Pick<PushManager, "getSubscription" | "subscribe">,
  applicationServerKey: Uint8Array<ArrayBuffer>,
) => Promise<PushSubscription>;

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
    const renewPushSubscription = (
      pushNotifications as typeof pushNotifications & {
        renewPushSubscription?: RenewPushSubscription;
      }
    ).renewPushSubscription;

    expect(renewPushSubscription).toBeTypeOf("function");
    if (!renewPushSubscription) return;

    await expect(
      renewPushSubscription(pushManager, new Uint8Array([1, 2, 3])),
    ).resolves.toBe(existing);
    expect(calls).toEqual(["get"]);
  });
});
