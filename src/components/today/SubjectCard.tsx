"use client";

import Link from "next/link";
import { CheckKind, RiskGrade } from "@/lib/domain";
import type { RosterSubject } from "@/lib/board/today";
import { useTodayWorkspace } from "./TodayWorkspace";
import { MapPinIcon, PhoneIcon } from "./icons";

/**
 * 대상자 카드 (Figma ① 8:1866 / 처리 완료본 14:2583 / 비경보일 ①-b).
 *
 * 카드가 담는 결정은 하나다 — "이 가구를 지금 어떻게 할 것인가" (PRD §9 화면당 결정 1개).
 * 경보일의 두 버튼은 보드가 가진 데이터로 상세를 연다(서버 왕복 없음).
 * 거기서 한 번 더 누르면 기록이 끝난다(탭 2회 이내).
 */

/** 등급별 테두리 — 색 의미는 요약 카드·등급 칩과 같아야 한다 (Figma ① 8:1861 계열) */
const GRADE_BORDER: Record<RiskGrade, string> = {
  [RiskGrade.CRITICAL]: "border-danger",
  [RiskGrade.HIGH]: "border-warn",
  [RiskGrade.MODERATE]: "border-line-soft",
};

interface Props {
  subject: RosterSubject;
  /** 경보일에만 준다 — 없으면 등급 없는 명단 카드 (①-b) */
  grade?: RiskGrade;
  /** 오늘 처리가 끝난 가구의 상태 배지 (HOUSEHOLD_STATUS_LABEL) */
  statusLabel?: string;
  /**
   * 지금 받을 수 있는 기록 종류. 1등급·승격 가구는 VISIT, 그 외는 CALL,
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
  /** 등급 필터를 적용한 채 상세에 들어갔다면 뒤로 갈 때 같은 필터로 돌아간다. */
  returnGrade?: RiskGrade;
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
}: Props) {
  const workspace = useTodayWorkspace();
  const query = new URLSearchParams({ date });
  if (workerId) query.set("workerId", workerId);
  if (returnGrade) query.set("grade", String(returnGrade));
  const href = `/today/${subject.subjectId}?${query.toString()}`;
  const openDetail = workspace
    ? () => workspace.openDetail(subject.subjectId)
    : undefined;
  const closed = nextCheckKind === null;
  const border = closed || !grade ? "border-line-soft" : GRADE_BORDER[grade];

  return (
    <li
      className={`flex flex-col gap-4 rounded-[10px] border bg-white px-5 py-6 ${border}`}
    >
      <div className="flex w-full items-center gap-4">
        <p className="flex flex-1 items-baseline gap-2.5">
          <span className="text-2xl font-bold text-ink">{subject.name}</span>
          <span className="text-base text-ink-soft">
            {subject.age}세{subject.livesAlone ? " · 독거" : ""}
          </span>
        </p>
        {statusLabel && (
          <span className="shrink-0 rounded-full border border-slate px-3.5 py-1.5 text-[15px] font-bold text-slate">
            {statusLabel}
          </span>
        )}
      </div>

      <div className="flex w-full gap-3">
        <CardAction
          href={href}
          onOpen={openDetail}
          enabled={nextCheckKind === CheckKind.VISIT}
          label="방문하기"
          icon={<MapPinIcon className="size-[18px]" />}
        />
        <CardAction
          href={callOnly && subject.phone ? `tel:${subject.phone}` : href}
          onOpen={callOnly ? undefined : openDetail}
          enabled={
            callOnly ? subject.phone !== null : nextCheckKind === CheckKind.CALL
          }
          external={callOnly}
          label="전화하기"
          icon={<PhoneIcon className="size-[18px]" />}
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
  label,
  icon,
}: {
  href: string;
  /** 보드가 이미 가진 데이터로 상세를 연다. 없으면 기존 Link로 폴백 */
  onOpen?: () => void;
  enabled: boolean;
  /** tel: 처럼 앱 밖으로 나가는 링크 — 라우터를 태우지 않는다 */
  external?: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  const shape =
    "flex h-12 flex-1 items-center justify-center gap-2 rounded-lg text-[15px] font-bold";

  if (!enabled) {
    return (
      // 지금 누를 수 없다는 사실도 정보다 — 1등급은 전화를 건너뛴다(PRD F3)
      <span
        aria-disabled="true"
        className={`${shape} bg-disabled text-ink-soft`}
      >
        {icon}
        {label}
      </span>
    );
  }

  const tone = `${shape} bg-slate text-white active:bg-ink-strong`;

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
