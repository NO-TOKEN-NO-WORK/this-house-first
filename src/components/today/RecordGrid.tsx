"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  CallResult,
  CALL_RESULT_LABEL,
  CheckKind,
  VisitResult,
  VISIT_RESULT_LABEL,
} from "@/lib/domain";
import {
  AlertCircleIcon,
  CheckIcon,
  PhoneOffIcon,
  SirenIcon,
  SnowflakeIcon,
  XIcon,
} from "./icons";

/**
 * 원터치 결과 기록 (PRD F4·§9) — Figma ② 1:812(전화) · ③ 1:975(방문).
 *
 * 보드에서 카드 버튼을 누르고(탭 1) 여기서 결과를 누르면(탭 2) 기록이 끝난다.
 * 한 화면에 결정은 하나 — "무슨 일이 있었나"만 묻는다.
 *
 * 버튼 문구는 도메인 상수(CALL_RESULT_LABEL·VISIT_RESULT_LABEL)를 그대로 쓴다.
 * 아래 style/hint는 색과 부연일 뿐 결과값의 의미를 새로 만들지 않는다 (AGENTS.md 도메인 규칙 2).
 */

interface Option {
  value: string;
  label: string;
  /** 결과가 무엇을 뜻하는지 도메인 주석에 이미 있는 부연 — 없으면 생략 */
  hint?: string;
  /** 이 결과가 부르는 후속 조치 (FR-11 지원사업 연계 등) */
  badge?: string;
  tone: string;
  icon: ReactNode;
}

const ICON = "size-6";

const CALL_OPTIONS: Option[] = [
  {
    value: CallResult.OK,
    label: CALL_RESULT_LABEL[CallResult.OK],
    tone: "border-safe bg-safe-soft text-safe-ink",
    icon: <CheckIcon className={ICON} />,
  },
  {
    value: CallResult.NO_ANSWER,
    label: CALL_RESULT_LABEL[CallResult.NO_ANSWER],
    tone: "border-slate bg-surface text-ink-strong",
    icon: <PhoneOffIcon className={ICON} />,
  },
  {
    value: CallResult.SYMPTOM,
    label: CALL_RESULT_LABEL[CallResult.SYMPTOM],
    hint: "바로 방문 큐로",
    tone: "border-danger bg-danger-soft text-danger-ink",
    icon: <AlertCircleIcon className={ICON} />,
  },
  {
    value: CallResult.UNREACHABLE,
    label: CALL_RESULT_LABEL[CallResult.UNREACHABLE],
    tone: "border-dashed border-slate bg-line text-ink-strong",
    icon: <XIcon className={ICON} />,
  },
];

const VISIT_OPTIONS: Option[] = [
  {
    value: VisitResult.OK,
    label: VISIT_RESULT_LABEL[VisitResult.OK],
    tone: "border-safe bg-safe-soft text-safe-ink",
    icon: <CheckIcon className={ICON} />,
  },
  {
    value: VisitResult.ACTED,
    label: VISIT_RESULT_LABEL[VisitResult.ACTED],
    hint: "냉방/수분",
    tone: "border-brand bg-brand-soft text-brand",
    icon: <SnowflakeIcon className={ICON} />,
  },
  {
    value: VisitResult.EMERGENCY_119,
    label: VISIT_RESULT_LABEL[VisitResult.EMERGENCY_119],
    tone: "border-danger bg-danger-soft text-danger-ink",
    icon: <SirenIcon className={ICON} />,
  },
  {
    value: VisitResult.AIRCON_ISSUE,
    label: VISIT_RESULT_LABEL[VisitResult.AIRCON_ISSUE],
    badge: "지원사업 연계",
    tone: "border-warn bg-warn-soft text-warn-ink",
    icon: <AlertCircleIcon className={ICON} />,
  },
];

interface Props {
  subjectId: string;
  kind: CheckKind;
  /** 기록 대상 경보일 "YYYY-MM-DD" */
  date: string;
  /** 오늘 마지막으로 기록한 결과값 — 같은 버튼에 "선택됨"을 표시한다 */
  lastResult: string | null;
}

export function RecordGrid({ subjectId, kind, date, lastResult }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const isCall = kind === CheckKind.CALL;
  const options = isCall ? CALL_OPTIONS : VISIT_OPTIONS;

  async function record(result: string) {
    setPending(result);
    setError(null);
    try {
      const res = await fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, kind, result, date }),
      });
      const json: { error?: { message?: string } } = await res.json();
      if (!res.ok) {
        // 상태머신이 막은 기록(재전화 30분 규칙 등)은 이유를 그대로 보여준다
        setError(json.error?.message ?? "기록하지 못했습니다.");
        return;
      }
      // 서버 컴포넌트가 최신 상태를 반영할 때까지 버튼을 잠가 연속 탭의 중복 기록을 막는다.
      startRefresh(() => router.refresh());
    } catch {
      setError("연결이 끊겨 기록하지 못했습니다. 다시 눌러 주세요.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="flex w-full flex-col gap-2">
      <h2 className="text-[15px] font-bold text-ink-soft">
        {isCall ? "전화 결과를 눌러 기록하세요" : "방문 상황을 기록하세요"}
      </h2>

      <div className="grid grid-cols-2 gap-2.5">
        {options.map((option) => {
          const selected = option.value === lastResult;
          return (
            <button
              key={option.value}
              type="button"
              disabled={pending !== null || isRefreshing}
              onClick={() => record(option.value)}
              aria-pressed={selected}
              className={`relative flex min-h-[86px] flex-col items-center justify-center gap-1.5 rounded-lg border text-[17px] font-bold disabled:opacity-60 ${option.tone} ${selected ? "border-2 border-ink-strong" : ""}`}
            >
              {selected && (
                <span className="absolute top-1.5 right-2 rounded-full bg-ink-strong px-2 py-px text-[11px] font-bold text-white">
                  선택됨
                </span>
              )}
              {option.icon}
              <span>
                {pending === option.value ? "기록 중…" : option.label}
              </span>
              {option.hint && (
                <span className="text-[13px] font-normal">{option.hint}</span>
              )}
              {option.badge && (
                <span className="rounded-full bg-warn px-2 py-px text-[11px] font-bold text-ink">
                  {option.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/*
        오류는 버튼 아래에 붙인다. 위에 끼워 넣으면 오류가 뜨는 순간 버튼 4개가 아래로 밀려
        방금 누르려던 자리에 다른 결과 버튼이 들어온다 — 60대 사용자 기준에서 오탭 사고다.
      */}
      {error && (
        <p
          role="alert"
          className="rounded-[10px] border border-danger bg-danger-soft px-4 py-3 text-[15px] leading-6 text-danger-ink"
        >
          {error}
        </p>
      )}
    </section>
  );
}
