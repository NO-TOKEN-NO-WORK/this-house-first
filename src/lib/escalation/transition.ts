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

/** 재전화 최소 간격 — PRD F4의 "무응답 2회(30분 간격)" */
export const NO_ANSWER_RETRY_INTERVAL_MS = 30 * 60 * 1_000;

interface TransitionBase {
  current: HouseholdStatus;
  /** 지금까지의 전화 시도 횟수 */
  callAttempts: number;
}

export interface CallTransitionInput extends TransitionBase {
  kind: typeof CheckKind.CALL;
  result: CallResult;
  /** 순수 함수 유지를 위해 호출부에서 주입하는 현재 시각 */
  now: Date;
  /** 가장 최근 전화 기록 시각. 첫 전화라면 null */
  lastCallAt: Date | null;
}

export interface VisitTransitionInput extends TransitionBase {
  kind: typeof CheckKind.VISIT;
  result: VisitResult;
}

/** kind가 result의 허용 집합을 결정한다 — 잘못된 결합을 컴파일 단계에서 차단 */
export type TransitionInput = CallTransitionInput | VisitTransitionInput;

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

/** 전화를 받을 수 있는 상태 — 심각·승격 가구는 전화가 아니라 방문 대상이다 (PRD F3) */
const CALLABLE: readonly HouseholdStatus[] = [
  HouseholdStatus.UNCHECKED,
  HouseholdStatus.NO_ANSWER_1,
];

/** 방문 기록을 받을 수 있는 상태 */
const VISITABLE: readonly HouseholdStatus[] = [
  HouseholdStatus.VISIT_QUEUED,
  HouseholdStatus.VISITING,
];

function callTransition(input: CallTransitionInput): TransitionOutcome {
  const { current, callAttempts, result } = input;

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
      if (current === HouseholdStatus.NO_ANSWER_1) {
        if (input.lastCallAt == null) {
          throw new TransitionError(
            "첫 무응답 전화 기록 시각을 찾지 못했습니다.",
            "PREVIOUS_CALL_NOT_FOUND",
          );
        }
        const elapsed = input.now.getTime() - input.lastCallAt.getTime();
        if (elapsed < NO_ANSWER_RETRY_INTERVAL_MS) {
          const remainingMinutes = Math.ceil(
            (NO_ANSWER_RETRY_INTERVAL_MS - elapsed) / 60_000,
          );
          throw new TransitionError(
            `재전화는 첫 무응답 기록 30분 후 가능합니다. ${remainingMinutes}분 뒤 다시 시도하세요.`,
            "RETRY_TOO_SOON",
          );
        }
      }

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

    case CallResult.EMERGENCY_119:
      // 통화 중 119를 불렀으면 방문의 119(VisitResult.EMERGENCY_119)와 같은 자리로 간다.
      // 승격이 아니라 종결이다 — 이미 응급 체계로 넘어갔으므로 방문 큐에 다시 올리지 않는다.
      return {
        status: HouseholdStatus.EMERGENCY_119,
        callAttempts: callAttempts + 1,
        promoted: false,
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

function visitTransition(input: VisitTransitionInput): TransitionOutcome {
  const { current, callAttempts, result } = input;

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

    case VisitResult.SYMPTOM:
    case VisitResult.ABSENT:
      /*
       * 방문했지만 그날 대응이 끝나지 않은 두 경우다 (Figma 113:2329 `걱정돼요`·`안 계셨어요`).
       * 방문 큐에 그대로 두어 재방문 대상으로 남긴다 — 조치 완료로 닫으면 아무도 다시
       * 가지 않는다. 이미 큐에 있던 가구라 새 승격(promoted)이 아니다 (ADR-0021).
       */
      return {
        ...base,
        status: HouseholdStatus.VISIT_QUEUED,
        airconIssue: false,
      };

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
