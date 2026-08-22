"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { RecordGrid } from "@/components/today/RecordGrid";
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  HomeIcon,
  InfoIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
} from "@/components/today/icons";
import type { CheckOutcome } from "@/lib/board/detail";
import type { SubjectDetail } from "@/lib/board/subject";
import { CheckKind, RiskGrade } from "@/lib/domain";
import {
  NO_ANSWER_PROMOTE_AT,
  NO_ANSWER_RETRY_INTERVAL_MS,
} from "@/lib/escalation/transition";
import {
  type LabeledReason,
  REASON_CATEGORY_LABEL,
  ReasonCategory,
} from "@/lib/scoring/reasons";

/**
 * 담당자 · 대상자 상세 + 원터치 기록 — FR-4·FR-5
 * 화면 설계: Figma ② 3:505 (기록 버튼은 같은 화면의 이전 판 1:812)
 *
 * 보드에서 연 때와 주소로 직접 들어올 때 같은 화면을 쓴다.
 * 위험 사유는 스코어링 엔진 문장을 그대로 싣고 분류 아이콘만 붙인다 (AGENTS.md 도메인 규칙 3).
 */

const GRADE_CHIP: Record<RiskGrade, string> = {
  [RiskGrade.CRITICAL]: "bg-status-critical text-text-inverse",
  [RiskGrade.HIGH]: "bg-status-warning text-text-primary",
  [RiskGrade.MODERATE]: "bg-status-neutral text-text-primary",
};

const REASON_ICON: Record<ReasonCategory, typeof UserIcon> = {
  [ReasonCategory.PERSONAL]: UserIcon,
  [ReasonCategory.BUILDING]: HomeIcon,
  [ReasonCategory.WEATHER]: AlertCircleIcon,
};

function ReasonRow({ reason }: { reason: LabeledReason }) {
  const Icon = reason.category ? REASON_ICON[reason.category] : null;
  return (
    <li className="flex items-center gap-2.5 text-body-16 text-text-primary">
      {Icon && (
        <Icon
          className={`size-5 shrink-0 ${
            reason.category === ReasonCategory.WEATHER
              ? "text-status-critical"
              : "text-icon-default"
          }`}
        />
      )}
      {reason.category && (
        <span className="font-bold">{REASON_CATEGORY_LABEL[reason.category]}</span>
      )}
      <span>{reason.text}</span>
    </li>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <p className="flex w-full items-start gap-2.5 rounded-[10px] border border-border-strong bg-background-subtle px-4 py-3.5 text-body-15-relaxed text-text-primary">
      <InfoIcon className="mt-0.5 size-[18px] shrink-0 text-action-primary" />
      <span>{children}</span>
    </p>
  );
}

function RecordArea({
  detail,
  onRecorded,
}: {
  detail: SubjectDetail;
  onRecorded?: (outcome: CheckOutcome) => void;
}) {
  if (!detail.alerted) {
    return (
      <Callout>
        오늘은 경보일이 아닙니다. 확인 기록은 폭염·한파 경보가 내려진 날에만
        남깁니다.
      </Callout>
    );
  }

  if (detail.status === null) {
    return (
      <Callout>
        이 대상자는 해당 경보일의 확인 대상에 포함되지 않아 결과를 기록할 수
        없습니다.
      </Callout>
    );
  }

  if (detail.nextCheckKind === null) {
    return (
      <Callout>
        오늘 확인이 끝난 가구입니다{detail.statusLabel ? ` · ${detail.statusLabel}` : ""}.
      </Callout>
    );
  }

  return (
    <>
      <RecordGrid
        subjectId={detail.subjectId}
        kind={detail.nextCheckKind}
        date={detail.date}
        lastResult={detail.lastResult}
        onRecorded={onRecorded}
      />
      {detail.nextCheckKind === CheckKind.CALL ? (
        <Callout>
          {NO_ANSWER_RETRY_INTERVAL_MS / 60_000}분 뒤 다시 확인하세요.{" "}
          <strong className="font-bold">
            {NO_ANSWER_PROMOTE_AT}회 무응답 시 자동으로 방문 큐로 올라갑니다.
          </strong>
        </Callout>
      ) : (
        <Callout>
          방문 대상 가구입니다. 전화로 &lsquo;괜찮다&rsquo;를 확인하는 대신 방문
          결과를 기록하세요.
        </Callout>
      )}
    </>
  );
}

const BACK_BTN =
  "flex size-11 items-center justify-center text-icon-primary";

export function SubjectDetailView({
  detail,
  backHref,
  onBack,
  onRecorded,
}: {
  detail: SubjectDetail;
  backHref: string;
  /** 있으면 Next 내비게이션 없이 보드로 되돌린다 (보드에서 연 상세) */
  onBack?: () => void;
  onRecorded?: (outcome: CheckOutcome) => void;
}) {
  /*
   * 방문 대상 가구에는 전화 걸기를 큰 버튼으로 내밀지 않는다 — 1등급은 전화로 '괜찮다'를
   * 확인하지 않는 것이 설계다 (PRD F3). 번호 자체는 위 연락처 줄에서 그대로 누를 수 있다.
   */
  const showCallCta =
    detail.phone !== null && detail.nextCheckKind !== CheckKind.VISIT;

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col bg-background-subtle">
      <header className="sticky top-0 z-30 flex h-[53px] items-center gap-2.5 border-b border-border-default bg-surface-default px-3.5">
        {onBack ? (
          <button
            type="button"
            aria-label="오늘의 대응 보드로"
            onClick={onBack}
            className={BACK_BTN}
          >
            <ChevronLeftIcon className="size-[22px]" />
          </button>
        ) : (
          <Link
            href={backHref}
            aria-label="오늘의 대응 보드로"
            className={BACK_BTN}
          >
            <ChevronLeftIcon className="size-[22px]" />
          </Link>
        )}
        <h1 className="text-label-16-compact text-text-primary">대상자 상세</h1>
      </header>

      <main
        className={`flex flex-1 flex-col gap-5 px-5 py-6 ${showCallCta ? "pb-[120px]" : "pb-10"}`}
      >
        <section className="flex flex-col gap-3">
          {detail.assessment && (
            <p>
              <span
                className={`inline-block rounded-full px-3 py-1.5 text-label-15 ${GRADE_CHIP[detail.assessment.grade]}`}
              >
                {detail.assessment.severityLabel}
              </span>
            </p>
          )}
          <p className="flex items-baseline gap-2.5">
            <span className="text-display-28 text-text-primary">{detail.name}</span>
            <span className="text-body-18 text-text-secondary">
              {detail.age}세{detail.livesAlone ? " · 독거" : ""}
            </span>
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-label-15 text-text-supporting">
            {detail.phone && (
              <a href={`tel:${detail.phone}`} className="flex items-center gap-2">
                <PhoneIcon className="size-[21px]" />
                {detail.phone}
              </a>
            )}
            <span className="flex items-center gap-2">
              <MapPinIcon className="size-[18px]" />
              {detail.roadAddress ?? detail.address}
            </span>
          </div>
        </section>

        {detail.assessment && (
          <section className="flex w-full flex-col gap-2.5 rounded-[10px] border border-border-default bg-surface-default p-6">
            <h2 className="text-label-15 text-text-secondary">위험 사유</h2>
            <ul className="flex flex-col gap-2.5">
              {detail.assessment.reasons.map((reason) => (
                <ReasonRow key={reason.text} reason={reason} />
              ))}
            </ul>
            <p className="text-body-15 text-text-secondary">
              대응 지시 · {detail.assessment.plan}
            </p>
          </section>
        )}

        <RecordArea detail={detail} onRecorded={onRecorded} />
      </main>

      {showCallCta && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[520px] border-t border-border-default bg-surface-default px-3.5 pt-3 pb-5">
          <a
            href={`tel:${detail.phone}`}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-action-primary text-heading-19 text-text-inverse active:bg-action-primary-strong"
          >
            <PhoneIcon className="size-[21px]" />
            전화 걸기
          </a>
        </div>
      )}
    </div>
  );
}
