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
  AlertTriangleIcon,
  ChevronLeftIcon,
  CheckIcon,
} from "@/components/today/icons";
import type { SubjectDetail } from "@/lib/board/subject";
import {
  CheckKind,
  CoolingStatus,
  COOLING_STATUS_LABEL,
  isVisitResult,
  type VisitResult,
  VisitResult as VisitResultValue,
  VISIT_RECORD_RESULTS,
  VISIT_RESULT_LABEL,
} from "@/lib/domain";

/**
 * 담당자 · 방문 화면 — 카드의 `방문하기`로 들어온다 (FR-5).
 * 화면 설계: Figma 113:2222(기록) · 115:2534(선택 상태) · 123:2971(방문 완료 기록 보기).
 *
 * 위에서 아래로 "이 사람이 왜 위험한가 → 무엇을 볼 것인가 → 무엇을 기록할 것인가" 한 방향이다.
 * 기록은 고른 뒤 `저장하기` 한 번으로 끝낸다 — 통화 결과 시트(`CallResultSheet`)와 같은 계약이라
 * 두 흐름이 서로 다른 저장 규칙을 갖지 않는다 (ADR-0021).
 */

const BACK_BUTTON =
  "flex size-11 items-center justify-center text-icon-primary";

interface VisitOption {
  value: VisitResult;
  /** 고르지 않았을 때의 아이콘 색 — 고르면 남색 위 흰색으로 덮인다 */
  tone: string;
  icon: ReactNode;
}

const OPTION_ICON = "size-6";

/** 아이콘만 화면이 정하고 문구·순서는 도메인 상수를 따른다 (AGENTS.md 도메인 규칙 2) */
const OPTION_VIEW: Record<VisitResult, { tone: string; icon: ReactNode }> = {
  [VisitResultValue.OK]: {
    tone: "text-status-success",
    icon: <CheckIcon className={OPTION_ICON} />,
  },
  [VisitResultValue.SYMPTOM]: {
    tone: "text-status-warning",
    icon: <AlertTriangleIcon className={OPTION_ICON} />,
  },
  [VisitResultValue.ABSENT]: {
    tone: "text-action-secondary",
    icon: (
      <Image src="/icons/visit/home-off.svg" alt="" width={24} height={24} />
    ),
  },
  [VisitResultValue.EMERGENCY_119]: {
    tone: "text-status-critical",
    icon: <AlertCircleIcon className={OPTION_ICON} />,
  },
  [VisitResultValue.ACTED]: {
    tone: "text-action-primary",
    icon: <CheckIcon className={OPTION_ICON} />,
  },
  [VisitResultValue.AIRCON_ISSUE]: {
    tone: "text-status-warning",
    icon: <AlertTriangleIcon className={OPTION_ICON} />,
  },
};

const VISIT_OPTIONS: VisitOption[] = VISIT_RECORD_RESULTS.map((value) => ({
  value,
  ...OPTION_VIEW[value],
}));

const COOLING_OPTIONS = Object.values(CoolingStatus);

/**
 * 고른 칸은 남색으로 채우고 글자·아이콘을 흰색으로 뒤집는다 (Figma 115:2668).
 * 테두리 굵기는 바꾸지 않는다 — 1px이라도 움직이면 방금 누른 자리가 흔들려
 * 60대 사용자 기준에서 오탭 사고가 난다 (ADR-0014).
 */
function chipTone(selected: boolean): string {
  return selected
    ? "bg-action-primary text-text-inverse"
    : "bg-surface-default text-text-secondary";
}

/**
 * 오늘 남긴 방문 기록 1건 — 되읽기 화면이 결과·메모를 여기서 가져온다.
 *
 * `detail.lastResult`를 쓰지 않는다. 그 값은 "오늘 마지막 확인"이라 전화 기록일 수 있고,
 * 전화·방문 결과는 문자열이 겹쳐(`OK`·`SYMPTOM`·`EMERGENCY_119`) 가드로도 못 가른다 —
 * 주소로 `?view=record`에 바로 들어오면 통화 결과가 방문 결과로 보인다.
 */
function todayVisitRecord(
  detail: SubjectDetail,
): { result: VisitResult | null; memo: string | null } {
  const record = detail.recentHistory.find(
    (item) => item.kind === CheckKind.VISIT && item.date === detail.date,
  );
  if (!record) return { result: null, memo: null };
  return {
    result: isVisitResult(record.result) ? record.result : null,
    memo: record.memo,
  };
}

/**
 * 방문 기록 폼 (Figma 113:2325~113:2386).
 *
 * `readOnly`는 이미 끝난 방문을 되읽는 화면이다 (`방문 완료 기록 보기`, Figma 123:2971).
 * 상태머신이 조치 완료 가구의 방문 기록을 막으므로(`NOT_VISITABLE`) 되읽기에는 저장 버튼을 두지
 * 않는다 — 누를 수 없는 버튼을 남기면 담당자가 저장이 안 된 줄 안다.
 */
function VisitRecordForm({
  detail,
  backHref,
  onSaved,
  readOnly = false,
}: {
  detail: SubjectDetail;
  backHref: string;
  /** 있으면 저장 뒤 Next 내비게이션 없이 보드로 되돌린다 (보드에서 연 방문 화면) */
  onSaved?: () => void;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const memoId = useId();
  const saved = readOnly
    ? todayVisitRecord(detail)
    : { result: null, memo: null };
  const [result, setResult] = useState<VisitResult | null>(saved.result);
  const [coolingStatus, setCoolingStatus] = useState<CoolingStatus | null>(null);
  const [memo, setMemo] = useState(saved.memo ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const incomplete = result === null || coolingStatus === null;

  async function save() {
    if (incomplete || pending) return;
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: detail.subjectId,
          kind: CheckKind.VISIT,
          result,
          coolingStatus,
          date: detail.date,
          ...(memo.trim() ? { memo: memo.trim() } : {}),
        }),
      });
      const payload: { error?: { message?: string } } = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "기록하지 못했습니다.");
        return;
      }

      /*
       * 완료된 방문 폼을 히스토리에 남기지 않는다. 브라우저 뒤로 가기로 이미 종결된 결과를
       * 다시 제출하면 상태머신이 거절하고 담당자에게 불필요한 오류만 보인다.
       */
      if (onSaved) onSaved();
      else router.replace(backHref);
      router.refresh();
    } catch {
      setError("연결이 끊겨 기록하지 못했습니다. 다시 눌러 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="flex flex-col gap-5 pt-3">
        <h2 className="text-heading-18 text-text-subtle">
          방문 상황을 기록하세요
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {VISIT_OPTIONS.map((option) => {
            const selected = option.value === result;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                disabled={pending || readOnly}
                onClick={() => setResult(option.value)}
                className={`flex h-[86px] flex-col items-center justify-center gap-[5px] rounded-lg border border-border-soft text-title-17 ${chipTone(selected)}`}
              >
                <span className={selected ? "text-text-inverse" : option.tone}>
                  {option.icon}
                </span>
                {VISIT_RESULT_LABEL[option.value]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-5 pt-3">
        <h2 className="text-heading-18 text-text-subtle">
          냉방기 설비 상태 점검
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {COOLING_OPTIONS.map((option) => {
            const selected = option === coolingStatus;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                disabled={pending || readOnly}
                onClick={() => setCoolingStatus(option)}
                className={`flex h-12 items-center justify-center rounded-lg border border-border-soft text-label-16 ${chipTone(selected)}`}
              >
                {COOLING_STATUS_LABEL[option]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-5 pt-3">
        <label htmlFor={memoId} className="text-heading-18 text-text-subtle">
          메모 (선택)
        </label>
        {/*
          자리 표시 글자색은 Figma의 `action/disabled`(#c6cfda, 흰 배경 대비 1.55:1) 대신
          `text-tertiary`(4.83:1)다. 그 대비로는 예시 문장이 보이지 않는다 (PRD §9).
        */}
        <input
          id={memoId}
          type="text"
          value={memo}
          maxLength={500}
          disabled={pending || readOnly}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="목소리가 기운 없으심"
          className="h-12 w-full rounded-lg border border-border-soft bg-surface-default px-4 text-body-15 text-text-primary placeholder:text-text-tertiary"
        />
      </section>

      {/* 결과·냉방기 상태를 고르기 전에는 저장할 것이 없다 — 빈 기록이 남지 않게 막는다 */}
      {!readOnly && (
        <button
          type="button"
          disabled={incomplete || pending}
          onClick={save}
          className={`flex h-14 w-full items-center justify-center rounded-lg text-heading-19 ${
            incomplete || pending
              ? "bg-surface-soft text-text-secondary"
              : "bg-action-primary text-text-inverse active:bg-action-primary-strong"
          }`}
        >
          {pending ? "저장 중…" : "저장하기"}
        </button>
      )}

      {/*
        실패 문구는 버튼 *아래*에 붙인다. 위에 끼우면 오류가 뜨는 순간 버튼이 밀려
        방금 누르려던 자리가 바뀐다 — 60대 사용자 기준에서 오탭 사고다 (ADR-0014).
      */}
      {error && (
        <p
          role="alert"
          className="rounded-[10px] border border-status-critical bg-status-critical-subtle px-4 py-3 text-body-15-relaxed text-status-critical-strong"
        >
          {error}
        </p>
      )}
    </>
  );
}

export function VisitDetailView({
  detail,
  backHref,
  onBack,
  readOnly = false,
}: {
  detail: SubjectDetail;
  backHref: string;
  onBack?: () => void;
  /** 이미 끝난 방문을 되읽는 화면 (`방문 완료 기록 보기`, Figma 123:2971) */
  readOnly?: boolean;
}) {
  const assessment = detail.assessment;
  /*
    Figma 123:2971의 머리글에는 글자가 없지만 제목 없는 화면은 어디에 있는지 말해 주지 못한다.
    되읽기 화면에는 카드 버튼과 같은 말(`방문 기록`)을 넣는다 (ADR-0021).
  */
  const title = readOnly ? "방문 기록" : "방문하기";

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
        <h1 className="text-center text-label-15 text-text-primary">{title}</h1>
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
        <VisitRecordForm
          detail={detail}
          backHref={backHref}
          onSaved={onBack}
          readOnly={readOnly}
        />
      </main>
    </div>
  );
}
