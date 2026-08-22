import { describe, expect, it } from "vitest";
import * as pushNotifications from "./PushNotificationManager";

type RenewPushSubscription = (
  pushManager: Pick<PushManager, "getSubscription" | "subscribe">,
  applicationServerKey: Uint8Array<ArrayBuffer>,
) => Promise<PushSubscription>;

describe("renewPushSubscription", () => {
  it("서버에 없는 기존 endpoint를 해지한 뒤 새로 구독한다", async () => {
    const calls: string[] = [];
    const fresh = { endpoint: "https://push.example.com/fresh" } as PushSubscription;
    const pushManager = {
      getSubscription: async () => {
        calls.push("get");
        return {
          unsubscribe: async () => {
            calls.push("unsubscribe");
            return true;
          },
        } as PushSubscription;
      },
      subscribe: async () => {
        calls.push("subscribe");
        return fresh;
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
    ).resolves.toBe(fresh);
    expect(calls).toEqual(["get", "unsubscribe", "subscribe"]);
  });
});
