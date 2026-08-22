"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { RiskReasonsCard } from "@/components/today/RiskReasonsCard";
import {
  GradeChangeNotice,
  VisitChecklist,
  VisitHistory,
} from "@/components/today/SubjectInformationSections";
import { SubjectSummary } from "@/components/today/SubjectSummary";
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  CheckIcon,
  SnowflakeIcon,
} from "@/components/today/icons";
import type { SubjectDetail } from "@/lib/board/subject";
import {
  CheckKind,
  type VisitResult,
  VisitResult as VisitResultValue,
  VISIT_RESULT_LABEL,
} from "@/lib/domain";

const BACK_BUTTON =
  "flex size-11 items-center justify-center text-icon-primary";

interface VisitOption {
  value: VisitResult;
  tone: string;
  icon: ReactNode;
}

const OPTION_ICON = "size-6";
const VISIT_OPTIONS: VisitOption[] = [
  {
    value: VisitResultValue.OK,
    tone: "text-status-success",
    icon: <CheckIcon className={OPTION_ICON} />,
  },
  {
    value: VisitResultValue.ACTED,
    tone: "text-action-primary",
    icon: <SnowflakeIcon className={OPTION_ICON} />,
  },
  {
    value: VisitResultValue.AIRCON_ISSUE,
    tone: "text-text-secondary",
    icon: (
      <Image
        src="/icons/visit/home-off.svg"
        alt=""
        width={24}
        height={24}
      />
    ),
  },
  {
    value: VisitResultValue.EMERGENCY_119,
    tone: "text-status-critical",
    icon: <AlertCircleIcon className={OPTION_ICON} />,
  },
];

/** 카드의 방문하기(탭 1) → 결과 버튼(탭 2)에서 바로 저장해 PRD §9를 지킨다. */
function VisitRecordForm({
  detail,
  backHref,
}: {
  detail: SubjectDetail;
  backHref: string;
}) {
  const router = useRouter();
  const memoId = useId();
  const [result, setResult] = useState<VisitResult | null>(null);
  const [memo, setMemo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save(selectedResult: VisitResult) {
    if (pending) return;
    setResult(selectedResult);
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: detail.subjectId,
          kind: CheckKind.VISIT,
          result: selectedResult,
          date: detail.date,
          ...(memo.trim() ? { memo: memo.trim() } : {}),
        }),
      });
      const payload: { error?: { message?: string } } = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "기록하지 못했습니다.");
        return;
      }

      // 완료된 방문 폼을 히스토리에 남기지 않는다. 브라우저 뒤로 가기로 이미 종결된 결과를
      // 다시 제출하면 상태머신이 거절하고 담당자에게 불필요한 오류만 보인다.
      router.replace(backHref);
      router.refresh();
    } catch {
      setError("연결이 끊겨 기록하지 못했습니다. 다시 눌러 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 pt-3">
      <section className="flex flex-col gap-5">
        <label htmlFor={memoId} className="text-heading-18 text-text-subtle">
          메모 (선택)
        </label>
        <input
          id={memoId}
          type="text"
          value={memo}
          maxLength={500}
          disabled={pending}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="필요할 때만 메모를 먼저 남겨 주세요"
          className="h-12 w-full rounded-lg border border-border-soft bg-surface-default px-4 text-body-15 text-text-primary placeholder:text-text-tertiary"
        />
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-heading-18 text-text-subtle">
          방문 결과를 눌러 기록하세요
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {VISIT_OPTIONS.map((option) => {
            const selected = option.value === result;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                disabled={pending}
                onClick={() => save(option.value)}
                className={`flex h-[86px] flex-col items-center justify-center gap-[5px] rounded-lg border text-title-17 disabled:opacity-60 ${
                  selected
                    ? "border-action-primary bg-action-primary text-text-inverse"
                    : "border-border-soft bg-surface-default text-text-secondary"
                }`}
              >
                <span className={selected ? "text-text-inverse" : option.tone}>
                  {option.icon}
                </span>
                {pending && selected
                  ? "저장 중…"
                  : VISIT_RESULT_LABEL[option.value]}
              </button>
            );
          })}
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-[10px] border border-status-critical bg-status-critical-subtle px-4 py-3 text-body-15-relaxed text-status-critical-strong"
          >
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

export function VisitDetailView({
  detail,
  backHref,
  onBack,
}: {
  detail: SubjectDetail;
  backHref: string;
  onBack?: () => void;
}) {
  const assessment = detail.assessment;

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col bg-surface-default">
      <header className="sticky top-0 z-30 grid h-[calc(53px_+_var(--safe-top))] grid-cols-[44px_1fr_44px] items-center pt-[var(--safe-top)] border-b border-border-default bg-surface-default px-1.5">
        {onBack ? (
          <button
            type="button"
            aria-label="오늘의 대응 보드로"
            onClick={onBack}
            className={BACK_BUTTON}
          >
            <ChevronLeftIcon className="size-[22px]" />
          </button>
        ) : (
          <Link
            href={backHref}
            aria-label="오늘의 대응 보드로"
            className={BACK_BUTTON}
          >
            <ChevronLeftIcon className="size-[22px]" />
          </Link>
        )}
        <h1 className="text-center text-label-15 text-text-primary">
          방문하기
        </h1>
        <span aria-hidden />
      </header>

      <main className="flex flex-1 flex-col gap-5 px-5 py-6 pb-10">
        {assessment && (
          <SubjectSummary
            name={detail.name}
            age={detail.age}
            livesAlone={detail.livesAlone}
            grade={assessment.grade}
            phone={detail.phone}
            address={detail.roadAddress ?? detail.address}
          />
        )}

        <GradeChangeNotice detail={detail} />

        {assessment && <RiskReasonsCard assessment={assessment} />}

        <VisitChecklist />
        <VisitHistory items={detail.recentHistory} />
        <VisitRecordForm detail={detail} backHref={backHref} />
      </main>
    </div>
  );
}
