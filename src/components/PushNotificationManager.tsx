"use client";

import { useEffect, useState } from "react";

type PushState = "checking" | "unsupported" | "off" | "on" | "denied";

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  return navigator.serviceWorker.ready;
}

export async function renewPushSubscription(
  pushManager: Pick<PushManager, "getSubscription" | "subscribe">,
  applicationServerKey: Uint8Array<ArrayBuffer>,
): Promise<PushSubscription> {
  await (await pushManager.getSubscription())?.unsubscribe();
  return pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
}

function subscribedOf(payload: unknown): boolean {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "data" in payload &&
      payload.data &&
      typeof payload.data === "object" &&
      "subscribed" in payload.data &&
      payload.data.subscribed === true,
  );
}

export function PushNotificationManager({
  workerId,
  publicKey,
}: {
  workerId: string;
  publicKey: string;
}) {
  const [state, setState] = useState<PushState>("checking");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (
        !publicKey ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const registered = await registration();
        const subscription = await registered.pushManager.getSubscription();
        if (!subscription) return false;
        const query = new URLSearchParams({
          workerId,
          endpoint: subscription.endpoint,
        });
        const response = await fetch(`/api/push-subscriptions?${query}`);
        if (!response.ok) return false;
        const payload: unknown = await response.json();
        return subscribedOf(payload);
      } catch {
        return false;
      }
    }).then((subscribed) => {
      if (!cancelled && typeof subscribed === "boolean") {
        setState(subscribed ? "on" : "off");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [publicKey, workerId]);

  if (!publicKey || state === "checking" || state === "unsupported") return null;

  async function subscribe() {
    setPending(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registered = await registration();
      const subscription = await renewPushSubscription(
        registered.pushManager,
        urlBase64ToUint8Array(publicKey),
      );
      const serialized = subscription.toJSON();
      const response = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId,
          endpoint: subscription.endpoint,
          keys: serialized.keys,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !subscribedOf(payload)) {
        await subscription.unsubscribe();
        throw new Error("구독 저장 실패");
      }
      setState("on");
      setMessage("이 기기로 푸시 알림을 받습니다.");
    } catch {
      setMessage("푸시 알림을 켜지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  async function unsubscribe() {
    setPending(true);
    setMessage(null);
    try {
      const registered = await registration();
      const subscription = await registered.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId, endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("구독 삭제 실패");
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("이 기기의 푸시 알림을 껐습니다.");
    } catch {
      setMessage("푸시 알림을 끄지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border-default bg-surface-default p-4 text-text-primary">
      <div className="min-w-0 flex-1">
        <p className="text-label-15">
          {state === "on" ? "푸시 알림 켜짐" : "푸시 알림"}
        </p>
        <p className="text-body-14 text-text-secondary" aria-live="polite">
          {state === "denied"
            ? "브라우저 설정에서 알림 권한을 허용해 주세요."
            : (message ?? "경보일 요약과 방문 승격만 알려 드립니다.")}
        </p>
      </div>
      {state !== "denied" ? (
        <button
          type="button"
          disabled={pending}
          onClick={state === "on" ? unsubscribe : subscribe}
          className="min-h-12 shrink-0 rounded-lg bg-action-primary px-4 text-label-15 text-text-inverse disabled:bg-action-disabled"
        >
          {pending ? "처리 중" : state === "on" ? "끄기" : "알림 받기"}
        </button>
      ) : null}
    </section>
  );
}
