"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { RiskReasonsCard } from "@/components/today/RiskReasonsCard";
import { SubjectSummary } from "@/components/today/SubjectSummary";
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  CheckIcon,
  SnowflakeIcon,
} from "@/components/today/icons";
import type {
  SubjectDetail,
  SubjectHistoryItem,
} from "@/lib/board/subject";
import {
  CheckKind,
  GRADE_LABEL,
  type VisitResult,
  VisitResult as VisitResultValue,
  VISIT_CHECKLIST,
  VISIT_RESULT_LABEL,
} from "@/lib/domain";

const BACK_BUTTON =
  "flex size-11 items-center justify-center text-icon-primary";

function GradeChangeNotice({ detail }: { detail: SubjectDetail }) {
  if (!detail.gradeChange) return null;

  // 상승 사실만 알린다. 원인을 임의로 단정하지 않고 바로 아래의 스코어링 reasons를 그대로 보여 준다.
  return (
    <section className="flex min-h-[90px] items-center gap-2.5 rounded-xl border border-status-critical bg-status-critical-subtle p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface-default">
        <Image
          src="/icons/visit/arrow-up.svg"
          alt=""
          width={20}
          height={20}
        />
      </span>
      <div className="min-w-0 text-body-14">
        <h2 className="text-label-14 text-status-critical-strong">
          오늘 위험 단계가 올라갔어요
        </h2>
        <p className="mt-1 text-text-secondary">
          {GRADE_LABEL[detail.gradeChange.previousGrade]} →{" "}
          {GRADE_LABEL[detail.gradeChange.currentGrade]}으로 상향됐어요
        </p>
      </div>
    </section>
  );
}

function VisitChecklist() {
  return (
    <section className="flex flex-col gap-4 rounded-[10px] border border-border-default bg-surface-default p-6">
      <h2 className="text-label-15 text-text-secondary">방문 체크리스트</h2>
      <ul className="flex list-disc flex-col gap-2.5 pl-5 text-body-16 text-text-primary">
        {VISIT_CHECKLIST.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function historyMarker(item: SubjectHistoryItem, isLast: boolean): string {
  if (
    item.result === VisitResultValue.AIRCON_ISSUE ||
    item.result === VisitResultValue.EMERGENCY_119
  ) {
    return "/icons/visit/timeline-warning.svg";
  }
  return isLast
    ? "/icons/visit/timeline-last.svg"
    : "/icons/visit/timeline.svg";
}

function VisitHistory({ items }: { items: SubjectHistoryItem[] }) {
  return (
    <section className="flex flex-col gap-6 overflow-hidden rounded-[14px] border border-border-default bg-surface-default p-4">
      <h2 className="text-label-15 text-text-secondary">방문 히스토리</h2>
      {items.length === 0 ? (
        <p className="text-body-15 text-text-secondary">
          최근 확인 기록이 없습니다.
        </p>
      ) : (
        <ol className="flex flex-col">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.id} className="flex min-h-[46px] gap-2.5">
                <Image
                  src={historyMarker(item, isLast)}
                  alt=""
                  width={18}
                  height={isLast ? 46 : 58}
                  className="h-full min-h-[46px] w-[18px] shrink-0 self-stretch"
                />
                <div className="min-w-0 flex-1 pb-3 text-body-14 text-text-primary">
                  <p className="flex items-center gap-2">
                    <strong className="text-label-14">{item.dateLabel}</strong>
                    <span className="text-caption-12 text-text-secondary">
                      {item.kindLabel}
                    </span>
                  </p>
                  <p className="mt-1.5 break-words">{item.resultLabel}</p>
                  {item.memo && (
                    <p className="mt-1 break-words text-text-secondary">
                      {item.memo}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

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
