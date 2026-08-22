"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  isAlertLevel,
  type AlertLevel as AlertLevelValue,
} from "../../lib/domain";
import styles from "../../app/admin/admin.module.css";

const DEMO_TRIGGER_FAILURE_MESSAGE = "데모 경보를 발령하지 못했습니다.";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface PushDispatchResult {
  configured: boolean;
  claimed: number;
  sent: number;
  failed: number;
  partialFailures?: number;
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
  { date, level }: { date: string; level: AlertLevelValue },
  fetcher: Fetcher = fetch,
): Promise<PushDispatchResult | null> {
  const response = await fetcher("/api/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetDate: date.replaceAll("-", ""), level }),
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
    ("partialFailures" in push && !isCount(push.partialFailures))
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

export function AdminControls({ date }: { date: string }) {
  const router = useRouter();
  const [pendingLevel, setPendingLevel] = useState<AlertLevelValue | null>(null);
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

  async function submitDemoTrigger(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const level = submitter?.value;
    if (!isAlertLevel(level)) return;

    setPendingLevel(level);
    setMessage(null);
    try {
      const push = await requestDemoTrigger({ date, level });
      setMessage(pushDispatchMessage(push));
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : DEMO_TRIGGER_FAILURE_MESSAGE,
      );
    } finally {
      setPendingLevel(null);
    }
  }

  return (
    <section className={styles.alertControls} aria-label="데모 경보 단계">
      <span className={styles.alertControlLabel}>경보 단계</span>
      <form className={styles.alertButtons} onSubmit={submitDemoTrigger}>
        {Object.values(AlertLevel).map((level) => (
          <button
            aria-busy={pendingLevel === level}
            aria-label={`${ALERT_LEVEL_LABEL[level]} 단계 발령`}
            className={styles.alertButton}
            data-level={level}
            disabled={pendingLevel !== null}
            key={level}
            type="submit"
            value={level}
          >
            {pendingLevel === level ? "발령 중…" : ALERT_LEVEL_LABEL[level]}
          </button>
        ))}
      </form>
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
