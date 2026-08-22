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
  const [level, setLevel] = useState<AlertLevelValue>(AlertLevel.WARNING);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [router]);

  async function submitDemoTrigger(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
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
      setPending(false);
    }
  }

  return (
    <section className={styles.demoPanel} aria-labelledby="demo-trigger-title">
      <h2 id="demo-trigger-title" className={styles.demoTitle}>
        데모 경보 발령
      </h2>
      <p id="demo-trigger-description" className={styles.demoDescription}>
        데모 전용 기능입니다. 실제 기상 예보 판정 대신 선택한 단계로 관제 화면을 갱신합니다.
      </p>
      <form className={styles.demoForm} onSubmit={submitDemoTrigger}>
        <label className={styles.demoField}>
          <span className={styles.filterLabel}>경보 단계</span>
          <select
            aria-describedby="demo-trigger-description"
            className={styles.filterControl}
            name="level"
            value={level}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (isAlertLevel(value)) setLevel(value);
            }}
          >
            {Object.values(AlertLevel).map((option) => (
              <option key={option} value={option}>
                {ALERT_LEVEL_LABEL[option]}
              </option>
            ))}
          </select>
        </label>
        <button
          aria-busy={pending}
          className={styles.submitButton}
          disabled={pending}
          type="submit"
        >
          {pending ? "발령 중…" : "데모 경보 발령"}
        </button>
      </form>
      {message ? (
        <p className={styles.demoStatus} role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </section>
  );
}
