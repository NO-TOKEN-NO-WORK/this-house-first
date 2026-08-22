"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../app/admin/admin.module.css";

const DEMO_TRIGGER_FAILURE_MESSAGE = "데모 경보를 발령하지 못했습니다.";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface PushDispatchResult {
  configured: boolean;
  claimed: number;
  sent: number;
  failed: number;
  partialFailures?: number;
  attemptedDevices?: number;
  sentDevices?: number;
  failedDevices?: number;
  recipientsWithoutSubscriptions?: number;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function errorMessage(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string" &&
    payload.error.message.trim()
  ) {
    return payload.error.message;
  }
  return DEMO_TRIGGER_FAILURE_MESSAGE;
}

export async function requestDemoTrigger(
  { date, enabled }: { date: string; enabled: boolean },
  fetcher: Fetcher = fetch,
): Promise<PushDispatchResult | null> {
  const response = await fetcher("/api/trigger", {
    method: enabled ? "POST" : "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetDate: date.replaceAll("-", ""),
      ...(enabled ? { demo: true } : {}),
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(payload));
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("push" in payload) ||
    payload.push === null
  ) {
    return null;
  }
  const push = payload.push;
  if (
    typeof push !== "object" ||
    push === null ||
    !("configured" in push) ||
    typeof push.configured !== "boolean" ||
    !("claimed" in push) ||
    !isCount(push.claimed) ||
    !("sent" in push) ||
    !isCount(push.sent) ||
    !("failed" in push) ||
    !isCount(push.failed) ||
    ("partialFailures" in push && !isCount(push.partialFailures)) ||
    ("attemptedDevices" in push && !isCount(push.attemptedDevices)) ||
    ("sentDevices" in push && !isCount(push.sentDevices)) ||
    ("failedDevices" in push && !isCount(push.failedDevices)) ||
    ("recipientsWithoutSubscriptions" in push &&
      !isCount(push.recipientsWithoutSubscriptions))
  ) {
    return null;
  }
  return push as PushDispatchResult;
}

export function pushDispatchMessage(result: PushDispatchResult | null): string {
  if (result === null) {
    return "경보는 발령됐지만 Push 발송 상태를 확인하지 못했습니다.";
  }
  if (!result.configured) {
    return "경보는 발령됐지만 Push 환경 변수가 설정되지 않았습니다.";
  }
  if (result.claimed === 0) {
    return "경보를 발령했습니다. 전송할 Push 알림이 없습니다.";
  }
  if (
    result.attemptedDevices !== undefined &&
    result.sentDevices !== undefined &&
    result.failedDevices !== undefined
  ) {
    if (result.attemptedDevices === 0) {
      return (result.recipientsWithoutSubscriptions ?? 0) > 0
        ? `경보 발령 · 구독된 기기 없음 · 미구독 담당자 ${result.recipientsWithoutSubscriptions}명`
        : "경보는 발령됐지만 구독된 기기가 없습니다.";
    }
    const details = [
      `경보 발령 · 기기 ${result.attemptedDevices}대 중 ${result.sentDevices}대 전송`,
      result.failedDevices > 0 ? `${result.failedDevices}대 실패` : null,
      (result.recipientsWithoutSubscriptions ?? 0) > 0
        ? `미구독 담당자 ${result.recipientsWithoutSubscriptions}명`
        : null,
    ].filter((message): message is string => message !== null);
    return details.join(" · ");
  }
  if (result.sent === 0 && result.failed === 0) {
    return "경보는 발령됐지만 구독된 기기가 없습니다.";
  }
  const failures = [
    result.failed > 0 ? `실패 ${result.failed}건` : null,
    (result.partialFailures ?? 0) > 0
      ? `부분 실패 ${result.partialFailures}건`
      : null,
  ].filter((message): message is string => message !== null);
  if (failures.length > 0) {
    return `경보 발령 · Push 성공 ${result.sent}건 · ${failures.join(" · ")}`;
  }
  return `경보 발령 · Push ${result.sent}건 전송`;
}

export function AdminControls({
  date,
  demoEnabled,
}: {
  date: string;
  demoEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function toggleDemo() {
    setPending(true);
    setMessage(null);
    try {
      const enabled = !demoEnabled;
      const push = await requestDemoTrigger({ date, enabled });
      setMessage(
        enabled
          ? pushDispatchMessage(push)
          : "데모를 종료하고 오늘 기록을 초기화했습니다.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : DEMO_TRIGGER_FAILURE_MESSAGE,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.alertControls} aria-label="폭염 데모 설정">
      <span className={styles.alertControlLabel}>38°C 폭염 데모</span>
      <div className={styles.alertButtons}>
        <button
          aria-label="38°C 폭염 데모"
          aria-busy={pending}
          aria-checked={demoEnabled}
          className={styles.alertButton}
          data-enabled={demoEnabled}
          disabled={pending}
          onClick={() => void toggleDemo()}
          role="switch"
          type="button"
        >
          {pending
            ? "변경 중…"
            : `38°C 데모 ${demoEnabled ? "켜짐" : "꺼짐"}`}
        </button>
      </div>
      {message ? (
        <p className={styles.alertMessage} role="status" aria-live="polite">
          {message}
          <button aria-label="알림 닫기" onClick={() => setMessage(null)} type="button">
            <Image alt="" aria-hidden="true" height={12} src="/admin/close.png" width={12} />
          </button>
        </p>
      ) : null}
    </section>
  );
}
