import {
  CallResult,
  CheckKind,
  HouseholdStatus,
  HOUSEHOLD_STATUS_LABEL,
  VisitResult,
} from "../domain";

/**
 * 에스컬레이션 상태머신 (FR-5, docs/architecture.md §4) — 순수 함수.
 *
 * 확인 기록 1건이 들어오면 가구의 다음 상태를 정한다. DB·시각·네트워크에 의존하지 않으므로
 * 전이 규칙 전체를 단위 테스트로 고정할 수 있다.
 *
 * 발령 시점의 진입 상태는 `initial.ts`가 담당한다.
 */

/** 무응답 승격 임계 횟수 — 무응답 2회(30분 간격)면 방문 큐로 (PRD F4) */
export const NO_ANSWER_PROMOTE_AT = 2;

export interface TransitionInput {
  current: HouseholdStatus;
  /** 지금까지의 전화 시도 횟수 */
  callAttempts: number;
  kind: CheckKind;
  result: CallResult | VisitResult;
}

export interface TransitionOutcome {
  status: HouseholdStatus;
  callAttempts: number;
  /** 이번 기록으로 방문 큐에 새로 올라갔는가 — 관리자 알림 대상 (PRD F4) */
  promoted: boolean;
  /** 에어컨 없음·고장 발견 — Subject.airconBroken(FR-8) + 지원사업 연계 플래그(FR-11) */
  airconIssue: boolean;
}

export class TransitionError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

/** 전화를 받을 수 있는 상태 — 1등급·승격 가구는 전화가 아니라 방문 대상이다 (PRD F3) */
const CALLABLE: readonly HouseholdStatus[] = [
  HouseholdStatus.UNCHECKED,
  HouseholdStatus.NO_ANSWER_1,
];

/** 방문 기록을 받을 수 있는 상태 */
const VISITABLE: readonly HouseholdStatus[] = [
  HouseholdStatus.VISIT_QUEUED,
  HouseholdStatus.VISITING,
];

function callTransition(input: TransitionInput): TransitionOutcome {
  const { current, callAttempts } = input;
  const result = input.result as CallResult;

  if (!CALLABLE.includes(current)) {
    if (
      current === HouseholdStatus.VISIT_QUEUED ||
      current === HouseholdStatus.VISITING
    ) {
      throw new TransitionError(
        "방문 대상 가구입니다. 전화로 '괜찮다'를 확인하는 대신 방문 결과를 기록하세요 (PRD F3).",
        "VISIT_TARGET",
      );
    }
    throw new TransitionError(
      `이미 ${HOUSEHOLD_STATUS_LABEL[current]} 상태라 전화 기록을 추가할 수 없습니다.`,
      "NOT_CALLABLE",
    );
  }

  switch (result) {
    case CallResult.OK:
      return {
        status: HouseholdStatus.CALL_OK,
        callAttempts: callAttempts + 1,
        promoted: false,
        airconIssue: false,
      };

    case CallResult.NO_ANSWER: {
      const attempts = callAttempts + 1;
      // 무응답 2회 → 자동 승격 (PRD F4)
      const promoted = attempts >= NO_ANSWER_PROMOTE_AT;
      return {
        status: promoted
          ? HouseholdStatus.VISIT_QUEUED
          : HouseholdStatus.NO_ANSWER_1,
        callAttempts: attempts,
        promoted,
        airconIssue: false,
      };
    }

    case CallResult.SYMPTOM:
      // 이상 징후는 횟수와 무관하게 즉시 승격
      return {
        status: HouseholdStatus.VISIT_QUEUED,
        callAttempts: callAttempts + 1,
        promoted: true,
        airconIssue: false,
      };

    case CallResult.UNREACHABLE:
      return {
        status: HouseholdStatus.UNREACHABLE,
        callAttempts: callAttempts + 1,
        promoted: false,
        airconIssue: false,
      };
  }
}

function visitTransition(input: TransitionInput): TransitionOutcome {
  const { current, callAttempts } = input;
  const result = input.result as VisitResult;

  if (!VISITABLE.includes(current)) {
    throw new TransitionError(
      `${HOUSEHOLD_STATUS_LABEL[current]} 상태에는 방문 결과를 기록할 수 없습니다. 방문 큐에 오른 가구만 가능합니다.`,
      "NOT_VISITABLE",
    );
  }

  const base = { callAttempts, promoted: false };
  switch (result) {
    case VisitResult.OK:
    case VisitResult.ACTED:
      return { ...base, status: HouseholdStatus.RESOLVED, airconIssue: false };

    case VisitResult.EMERGENCY_119:
      return {
        ...base,
        status: HouseholdStatus.EMERGENCY_119,
        airconIssue: false,
      };

    case VisitResult.AIRCON_ISSUE:
      // 조치는 끝났지만 에어컨 문제는 익일 위험도에 가중된다 (FR-8)
      return { ...base, status: HouseholdStatus.RESOLVED, airconIssue: true };
  }
}

export function transition(input: TransitionInput): TransitionOutcome {
  return input.kind === CheckKind.CALL
    ? callTransition(input)
    : visitTransition(input);
}
