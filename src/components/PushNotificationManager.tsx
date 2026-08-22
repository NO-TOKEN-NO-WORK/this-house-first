"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 이 기기의 Web Push 구독을 켜고 끈다 (ADR-0017).
 *
 * 관리자 화면에서는 알림 피드 옆에, 담당자 `/today`에서는 사용자가 직접 연
 * 후순위 앱 설정 안에만 놓인다. 자동으로 화면을 덮는 권한 요청 UI는 만들지 않는다.
 *
 * 권한을 이미 허용한 기기에서는 먼저 자동 구독하고, 브라우저가 막으면 설정에서 수동 재시도한다.
 * `Notification.requestPermission()`과 일부 브라우저의 `PushManager.subscribe()`는 사용자 동작 없이
 * 호출하면 거부되므로 처음 권한을 묻거나 자동 복구가 막힌 때는 "알림 받기"를 눌러야 한다.
 */

type PushState =
  | "checking"
  | "unsupported"
  | "install"
  | "off"
  | "on"
  | "denied";

class PushSetupError extends Error {
  constructor(readonly stage: "subscribe" | "save") {
    super(stage);
  }
}

function needsIosHomeScreenInstall(): boolean {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !standalone;
}

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
  const existing = await pushManager.getSubscription();
  if (existing) return existing;
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

type SubscriptionStatus = "subscribed" | "missing" | "unknown";

/**
 * 이 기기의 endpoint가 서버에도 살아 있는지 확인한다.
 * 조회 장애를 `missing`으로 오인하면 정상 구독을 불필요하게 교체하므로 따로 구분한다.
 */
async function readSubscriptionStatus(
  registered: ServiceWorkerRegistration,
  workerId: string,
): Promise<SubscriptionStatus> {
  try {
    const subscription = await registered.pushManager.getSubscription();
    if (!subscription) return "missing";
    const query = new URLSearchParams({
      workerId,
      endpoint: subscription.endpoint,
    });
    const response = await fetch(`/api/push-subscriptions?${query}`);
    if (!response.ok) return "unknown";
    const payload: unknown = await response.json();
    return subscribedOf(payload) ? "subscribed" : "missing";
  } catch {
    return "unknown";
  }
}

/**
 * 서버에 없는 endpoint를 새로 만든 뒤 저장한다. 구독 직후 발송기가 endpoint를
 * 만료로 판정해 지웠다면 서버 응답의 `subscribed`도 false이므로 브라우저 구독을 되돌린다.
 */
async function createSubscription(
  registered: ServiceWorkerRegistration,
  workerId: string,
  publicKey: string,
): Promise<void> {
  let subscription: PushSubscription;
  try {
    subscription = await renewPushSubscription(
      registered.pushManager,
      urlBase64ToUint8Array(publicKey),
    );
  } catch {
    throw new PushSetupError("subscribe");
  }

  try {
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
      throw new Error("구독 저장 실패");
    }
  } catch (error) {
    await subscription.unsubscribe().catch(() => false);
    throw error instanceof PushSetupError ? error : new PushSetupError("save");
  }
}

async function removeSubscription(workerId: string): Promise<void> {
  const registered = await registration();
  const subscription = await registered.pushManager.getSubscription();
  if (!subscription) return;
  const response = await fetch("/api/push-subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workerId, endpoint: subscription.endpoint }),
  });
  if (!response.ok) throw new Error("구독 삭제 실패");
  await subscription.unsubscribe();
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
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 이 effect의 setState는 모두 await 뒤에서 일어난다 (동기 setState는 연쇄 렌더가 된다)
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
      if (needsIosHomeScreenInstall()) {
        if (!cancelled) setState("install");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }

      let registered: ServiceWorkerRegistration;
      try {
        registered = await registration();
        registrationRef.current = registered;
      } catch {
        if (!cancelled) {
          setMessage("서비스 워커를 준비하지 못했습니다. 앱을 다시 열어 주세요.");
          setState("off");
        }
        return;
      }

      const subscriptionStatus = await readSubscriptionStatus(
        registered,
        workerId,
      );
      if (cancelled) return;
      if (subscriptionStatus === "subscribed") {
        setState("on");
        return;
      }

      // 서버가 endpoint를 잃은 것이 확실하고 권한이 남아 있으면 묻지 않고 복구한다.
      if (
        subscriptionStatus === "missing" &&
        Notification.permission === "granted"
      ) {
        try {
          await createSubscription(registered, workerId, publicKey);
          if (!cancelled) setState("on");
          return;
        } catch {
          if (cancelled) return;
          // 일부 브라우저는 이미 허용된 권한이어도 사용자 동작 없는 subscribe를 막는다.
          // 수동 재시도 버튼으로 폴백한다.
        }
      }

      if (cancelled) return;
      setState("off");
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
        // 왜 안 켜졌는지 남긴다 — 아무 말 없이 상태만 돌아가면 눌렀는지조차 알 수 없다
        setMessage(
          permission === "denied"
            ? "브라우저 설정에서 알림 권한을 허용해 주세요."
            : "알림 권한을 허용해야 켤 수 있습니다.",
        );
        return;
      }
      const registered = registrationRef.current;
      if (!registered) {
        setMessage("서비스 워커를 준비하지 못했습니다. 앱을 다시 열어 주세요.");
        return;
      }
      await createSubscription(registered, workerId, publicKey);
      setState("on");
      setMessage("이 기기로 푸시 알림을 받습니다.");
    } catch (error) {
      setMessage(
        error instanceof PushSetupError && error.stage === "subscribe"
          ? "이 기기에서 Push 구독을 만들지 못했습니다. 앱을 다시 열어 주세요."
          : error instanceof PushSetupError && error.stage === "save"
            ? "Push 구독을 서버에 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."
            : "푸시 알림을 켜지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setPending(false);
    }
  }

  async function unsubscribe() {
    setPending(true);
    setMessage(null);
    try {
      await removeSubscription(workerId);
      setState("off");
      setMessage("이 기기의 푸시 알림을 껐습니다.");
    } catch {
      setMessage("푸시 알림을 끄지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  const title = state === "on" ? "푸시 알림 켜짐" : "푸시 알림";
  const description =
    message ??
    (state === "denied"
      ? "브라우저 설정에서 알림 권한을 허용해 주세요."
      : state === "install"
        ? "iPhone에서는 먼저 공유 메뉴에서 홈 화면에 추가한 뒤 앱으로 열어 주세요."
      : "경보일 요약과 방문 승격만 알려 드립니다.");

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border-default bg-surface-default p-4 text-text-primary">
      <div className="min-w-0 flex-1">
        <p className="text-label-15">{title}</p>
        <p className="text-body-14 text-text-secondary" aria-live="polite">
          {description}
        </p>
      </div>
      {state !== "denied" && state !== "install" ? (
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
