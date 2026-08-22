import {
  type CallResult,
  CallResult as CallResultValue,
  HouseholdStatus,
  NotificationCause,
  type RiskGrade,
  RiskGrade as RiskGradeValue,
} from "../domain";
import {
  morningSummaryDraft,
  type NotificationDraft,
} from "./message";

export function morningSummaryDrafts(input: {
  alertDayId: string;
  date: string;
  level: Parameters<typeof morningSummaryDraft>[0]["level"];
  availableAt: Date;
  subjects: Array<{ workerId: string; grade: RiskGrade }>;
}): NotificationDraft[] {
  const counts = new Map<
    string,
    { totalCount: number; criticalCount: number }
  >();
  for (const subject of input.subjects) {
    const current = counts.get(subject.workerId) ?? {
      totalCount: 0,
      criticalCount: 0,
    };
    current.totalCount += 1;
    if (subject.grade === RiskGradeValue.CRITICAL) current.criticalCount += 1;
    counts.set(subject.workerId, current);
  }

  return [...counts].map(([recipientId, values]) =>
    morningSummaryDraft({
      alertDayId: input.alertDayId,
      date: input.date,
      level: input.level,
      recipientId,
      ...values,
      availableAt: input.availableAt,
    }),
  );
}

/** 새 경보일의 초기 심각 대상자는 요약만, 당일 재분류된 미확인 가구만 승격 알림을 받는다. */
export function reclassificationRecipientIds(input: {
  current: HouseholdStatus | null;
  next: HouseholdStatus;
  workerId: string;
  managerIds: string[];
}): string[] {
  if (
    input.current !== HouseholdStatus.UNCHECKED ||
    input.next !== HouseholdStatus.VISIT_QUEUED
  ) {
    return [];
  }
  return [...new Set([input.workerId, ...input.managerIds])];
}

/** 상태머신의 promoted=true인 전화 결과만 승격 원인으로 바꾼다. */
export function promotedCallCause(
  result: CallResult,
): NotificationCause | null {
  if (result === CallResultValue.SYMPTOM) return NotificationCause.SYMPTOM;
  if (result === CallResultValue.NO_ANSWER) {
    return NotificationCause.NO_ANSWER_2;
  }
  return null;
}
