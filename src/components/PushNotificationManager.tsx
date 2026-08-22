"use client";

import { useEffect, useState } from "react";
import { XIcon } from "@/components/today/icons";

/**
 * 이 기기의 Web Push 구독을 켜고 끈다 (ADR-0017).
 *
 * 두 가지 모습으로 쓴다:
 *  - `panel` — 관리자 화면. 알림 피드 옆에 놓이는 카드 (기존 모습)
 *  - `toast` — 담당자 `/today`. 화면 아래에 잠깐 뜨는 띠. 오늘 할 일 위에 알림 설정이 먼저 오면
 *    "화면당 결정 1개"(PRD §9)가 깨진다. 결정은 대상자 카드에 두고, 알림은 아래에서 물어본다.
 *
 * 권한을 이미 허용한 기기에서는 먼저 자동 구독하고, 브라우저가 막으면 띠에서 수동 재시도한다.
 * `Notification.requestPermission()`과 일부 브라우저의 `PushManager.subscribe()`는 사용자 동작 없이
 * 호출하면 거부되므로 처음 권한을 묻거나 자동 복구가 막힌 때는 "알림 받기"를 눌러야 한다.
 */

type PushState = "checking" | "unsupported" | "off" | "on" | "denied";

/**
 * 띠를 닫아 둔 상태는 이 세션에만 남긴다.
 * 영구 저장하면 한 번 닫은 담당자에게 다시는 묻지 못하고, 저장을 안 하면 화면을 옮길 때마다 다시 뜬다.
 */
const DISMISS_KEY = "push-toast-dismissed";

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

type SubscriptionStatus = "subscribed" | "missing" | "unknown";

/**
 * 이 기기의 endpoint가 서버에도 살아 있는지 확인한다.
 * 조회 장애를 `missing`으로 오인하면 정상 구독을 불필요하게 교체하므로 따로 구분한다.
 */
async function readSubscriptionStatus(
  workerId: string,
): Promise<SubscriptionStatus> {
  try {
    const registered = await registration();
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
  workerId: string,
  publicKey: string,
): Promise<void> {
  const registered = await registration();
  const subscription = await renewPushSubscription(
    registered.pushManager,
    urlBase64ToUint8Array(publicKey),
  );

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
    throw error;
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
  variant = "panel",
}: {
  workerId: string;
  publicKey: string;
  variant?: "panel" | "toast";
}) {
  const [state, setState] = useState<PushState>("checking");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

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
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }

      const subscriptionStatus = await readSubscriptionStatus(workerId);
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
          await createSubscription(workerId, publicKey);
          if (!cancelled) setState("on");
          return;
        } catch {
          if (cancelled) return;
          // 일부 브라우저는 이미 허용된 권한이어도 사용자 동작 없는 subscribe를 막는다.
          // 아래의 닫힘 상태를 복원한 뒤 수동 재시도 띠로 폴백한다.
        }
      }

      let alreadyDismissed = false;
      try {
        alreadyDismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        alreadyDismissed = false;
      }
      if (cancelled) return;
      setDismissed(alreadyDismissed);
      setState("off");
    });

    return () => {
      cancelled = true;
    };
  }, [publicKey, workerId]);

  /** 알린 내용은 잠깐만 둔다 — 띠가 화면 아래를 계속 가리면 다음 결정이 늦어진다 */
  useEffect(() => {
    if (variant !== "toast" || message === null) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [variant, message]);

  if (!publicKey || state === "checking" || state === "unsupported") return null;

  async function subscribe() {
    setPending(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        // 왜 안 켜졌는지 남긴다 — 아무 말 없이 띠만 사라지면 눌렀는지조차 알 수 없다
        setMessage(
          permission === "denied"
            ? "브라우저 설정에서 알림 권한을 허용해 주세요."
            : "알림 권한을 허용해야 켤 수 있습니다.",
        );
        return;
      }
      await createSubscription(workerId, publicKey);
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
      await removeSubscription(workerId);
      setState("off");
      setMessage("이 기기의 푸시 알림을 껐습니다.");
    } catch {
      setMessage("푸시 알림을 끄지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  function dismiss() {
    setMessage(null);
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* 저장이 막힌 브라우저에서는 이 화면에서만 닫힌다 */
    }
  }

  const title = state === "on" ? "푸시 알림 켜짐" : "푸시 알림";
  const description =
    message ??
    (state === "denied"
      ? "브라우저 설정에서 알림 권한을 허용해 주세요."
      : "경보일 요약과 방문 승격만 알려 드립니다.");

  if (variant === "toast") {
    /*
     * 띠를 띄우는 때는 둘뿐이다: 아직 안 켠 기기에 물을 때, 방금 누른 결과를 알릴 때.
     * 이미 켜진 기기(자동 구독 포함)와 닫아 둔 세션에는 아무것도 뜨지 않는다.
     */
    const asking = state === "off" && !dismissed;
    if (!asking && message === null) return null;

    return (
      <div
        role="status"
        aria-live="polite"
        // 하단 탭(79px) 위에 띄운다. 다이얼로그(z-50)보다는 아래다
        className="pointer-events-none fixed inset-x-0 bottom-[79px] z-40 mx-auto flex w-full max-w-[520px] justify-center px-5 pb-3"
      >
        <div className="pointer-events-auto flex w-full items-center gap-3 rounded-[14px] border border-border-default bg-surface-default p-4 shadow-lg motion-safe:animate-toast-in">
          <div className="min-w-0 flex-1">
            <p className="text-label-15 text-text-primary">{title}</p>
            <p className="text-body-14 text-text-secondary">{description}</p>
          </div>
          {state === "off" ? (
            <button
              type="button"
              disabled={pending}
              onClick={subscribe}
              className="min-h-12 shrink-0 rounded-lg bg-action-primary px-4 text-label-15 text-text-inverse disabled:bg-action-disabled"
            >
              {pending ? "처리 중" : "알림 받기"}
            </button>
          ) : null}
          {/* 글리프는 24px이지만 누르는 자리는 44px다 (60대 사용자 기준 터치 타깃, PRD §9) */}
          <button
            type="button"
            onClick={dismiss}
            aria-label="알림 안내 닫기"
            className="flex size-11 shrink-0 items-center justify-center text-icon-default"
          >
            <XIcon className="size-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border-default bg-surface-default p-4 text-text-primary">
      <div className="min-w-0 flex-1">
        <p className="text-label-15">{title}</p>
        <p className="text-body-14 text-text-secondary" aria-live="polite">
          {description}
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
