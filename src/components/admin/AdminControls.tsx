"use client";

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
): Promise<void> {
  const response = await fetcher("/api/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetDate: date.replaceAll("-", ""), level }),
  });

  if (response.ok) return;

  const payload: unknown = await response.json().catch(() => null);
  throw new Error(errorMessage(payload));
}

export function AdminControls({ date }: { date: string }) {
  const router = useRouter();
  const [pendingLevel, setPendingLevel] = useState<AlertLevelValue | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [router]);

  async function submitDemoTrigger(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const level = submitter?.value;
    if (!isAlertLevel(level)) return;

    setPendingLevel(level);
    setMessage(null);
    try {
      await requestDemoTrigger({ date, level });
      setMessage("데모 경보를 발령했습니다.");
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
        </p>
      ) : null}
    </section>
  );
}
