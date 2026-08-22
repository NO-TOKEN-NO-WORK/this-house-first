"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckKind, RiskGrade } from "@/lib/domain";
import type { RosterSubject } from "@/lib/board/today";
import { useTodayWorkspace } from "./TodayWorkspace";
import { AlertTriangleIcon, MapPinIcon, PhoneIcon } from "./icons";

/**
 * 대상자 카드 (Figma ① 25:62 / 처리 완료본 25:80 / 비경보일 ①-b).
 *
 * 카드가 담는 결정은 하나다 — "이 가구를 지금 어떻게 할 것인가" (PRD §9 화면당 결정 1개).
 * 전화는 보드 위 안내 흐름을 열고, 방문은 최근 기록까지 읽는 서버 상세 라우트로 이동한다.
 */

/** 위험 단계별 테두리 — 색 의미는 요약 카드·위험 단계 칩과 같아야 한다 (Figma ① 25:62 · 25:106 · 25:129) */
const GRADE_BORDER: Record<RiskGrade, string> = {
  [RiskGrade.CRITICAL]: "border-status-critical",
  [RiskGrade.HIGH]: "border-status-warning",
  [RiskGrade.MODERATE]: "border-border-strong",
};

interface Props {
  subject: RosterSubject;
  /** 경보일에만 준다 — 없으면 위험 단계 없는 명단 카드 (①-b) */
  grade?: RiskGrade;
  /** 오늘 처리가 끝난 가구의 상태 배지 (HOUSEHOLD_STATUS_LABEL) */
  statusLabel?: string;
  /**
   * 지금 받을 수 있는 기록 종류. 심각·승격 가구는 VISIT, 그 외는 CALL,
   * 오늘 할 일이 끝났거나 비경보일이면 null — 해당하지 않는 버튼은 눌리지 않는다.
   */
  nextCheckKind: CheckKind | null;
  /**
   * 경보일이 아닐 때(①-b). 남길 기록이 없으므로 전화 버튼이 상세가 아니라 바로 전화를 건다.
   * 방문은 경보일의 방문 큐에서만 시작하므로 그대로 비활성이다.
   */
  callOnly?: boolean;
  /** 상세로 넘길 경보일. 보드에서 다른 날짜를 보고 있으면 그 날짜를 그대로 잇는다 */
  date: string;
  /** 로그인 없는 v0에서 선택한 담당자 문맥을 상세→보드 왕복 동안 보존한다. */
  workerId?: string;
  /** 위험 단계 필터를 적용한 채 상세에 들어갔다면 뒤로 갈 때 같은 필터로 돌아간다. */
  returnGrade?: RiskGrade;
  /**
   * 아직 끝나지 않은 진행 상태 한 줄 — `"무응답 1회 · 9시 10분"` (Figma ⑥ 38:3534).
   * 이게 있으면 카드에 배너가 붙고 전화 버튼이 `다시 전화하기`(주 행동)로 바뀐다.
   */
  retryNote?: string;
}

export function SubjectCard({
  subject,
  grade,
  statusLabel,
  nextCheckKind,
  callOnly = false,
  date,
  workerId,
  returnGrade,
  retryNote,
}: Props) {
  const workspace = useTodayWorkspace();
  const query = new URLSearchParams({ date });
  if (workerId) query.set("workerId", workerId);
  if (returnGrade) query.set("grade", String(returnGrade));
  const href = `/today/${subject.subjectId}?${query.toString()}`;
  const infoQuery = new URLSearchParams(query);
  infoQuery.set("view", "info");
  const infoHref = `/today/${subject.subjectId}?${infoQuery.toString()}`;
  /*
    경보일의 `전화하기`는 상세 대신 전화 안내(④)를 연다 — 걸기 전에 무엇을 물을지 보여 주고,
    통화가 끝나면 결과 시트(⑤)로 이어진다 (FR-5).
    비경보일(`callOnly`)은 남길 기록이 없으므로 지금처럼 바로 `tel:`이다 (ADR-0014).
  */
  const openCallGuide = workspace
    ? () => workspace.openCallGuide(subject.subjectId)
    : undefined;
  const closed = nextCheckKind === null;
  const border = closed || !grade ? "border-border-soft" : GRADE_BORDER[grade];

  return (
    <li
      className={`flex flex-col gap-4 rounded-[10px] border bg-surface-default px-5 py-6 ${border}`}
    >
      <div className="flex w-full items-center gap-1.5">
        <p className="flex flex-1 items-baseline gap-2.5">
          <span className="text-heading-24 text-text-primary">{subject.name}</span>
          <span className="text-body-16 text-text-secondary">
            {subject.age}세{subject.livesAlone ? " · 독거" : ""}
          </span>
        </p>
        {statusLabel && (
          <span className="shrink-0 rounded-full border border-action-secondary px-3.5 py-1.5 text-body-15 text-text-tertiary">
            {statusLabel}
          </span>
        )}
        <Link
          href={infoHref}
          aria-label={`${subject.name} 대상자 정보`}
          className="-mr-2.5 flex size-11 shrink-0 items-center justify-center rounded-lg active:bg-surface-soft"
        >
          <Image
            src="/figma/chevron-right.svg"
            alt=""
            width={24}
            height={24}
          />
        </Link>
      </div>

      {retryNote && (
        // 왜 아직 안 끝났는지를 카드 안에서 말해 준다 — 담당자가 상세를 열지 않아도 알 수 있다
        <p className="flex w-full items-center justify-center gap-2.5 rounded-[20px] bg-status-warning-subtle px-4 py-2.5 text-label-15 text-text-secondary">
          <AlertTriangleIcon className="size-6 shrink-0 text-status-warning" />
          {retryNote}
        </p>
      )}

      <div className="flex w-full gap-3">
        <CardAction
          href={href}
          // 방문 화면은 최근 기록·직전 위험 단계까지 읽으므로 서버 상세 라우트로 이동한다.
          enabled={nextCheckKind === CheckKind.VISIT}
          label="방문하기"
          icon={<MapPinIcon className="size-[18px]" />}
        />
        <CardAction
          href={callOnly && subject.phone ? `tel:${subject.phone}` : href}
          onOpen={callOnly ? undefined : openCallGuide}
          enabled={
            callOnly ? subject.phone !== null : nextCheckKind === CheckKind.CALL
          }
          external={callOnly}
          primary={retryNote !== undefined}
          label={retryNote ? "다시 전화하기" : "전화하기"}
          icon={<PhoneIcon className="size-[21px]" />}
        />
      </div>
    </li>
  );
}

function CardAction({
  href,
  onOpen,
  enabled,
  external = false,
  primary = false,
  label,
  icon,
}: {
  href: string;
  /** 보드가 이미 가진 데이터로 상세를 연다. 없으면 기존 Link로 폴백 */
  onOpen?: () => void;
  enabled: boolean;
  /** tel: 처럼 앱 밖으로 나가는 링크 — 라우터를 태우지 않는다 */
  external?: boolean;
  /** 지금 이 카드에서 해야 할 일 — 남색으로 눈에 띄게 한다 (Figma ⑥ 38:3539) */
  primary?: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  const shape =
    "flex h-12 flex-1 items-center justify-center gap-2 rounded-lg text-label-15";

  if (!enabled) {
    return (
      // 지금 누를 수 없다는 사실도 정보다 — 심각 단계는 전화를 건너뛴다(PRD F3)
      <span
        aria-disabled="true"
        className={`${shape} bg-surface-soft text-text-secondary`}
      >
        {icon}
        {label}
      </span>
    );
  }

  const tone = primary
    ? `${shape} bg-action-primary text-text-inverse active:bg-action-primary-strong`
    : `${shape} bg-action-secondary text-text-inverse active:bg-action-secondary-strong`;

  if (external) {
    return (
      <a href={href} className={tone}>
        {icon}
        {label}
      </a>
    );
  }

  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={tone}>
        {icon}
        {label}
      </button>
    );
  }

  return (
    <Link href={href} className={tone}>
      {icon}
      {label}
    </Link>
  );
}
