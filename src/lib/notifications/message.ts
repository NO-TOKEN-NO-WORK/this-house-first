import {
  type AlertLevel,
  ALERT_LEVEL_LABEL,
  type NotificationCause,
  NOTIFICATION_CAUSE_LABEL,
  NotificationType,
} from "../domain";

/** Prisma createMany가 받는 알림 사건의 공통 필드. DB와 무관한 순수 빌더의 출력이다. */
export interface NotificationDraft {
  eventKey: string;
  type: (typeof NotificationType)[keyof typeof NotificationType];
  cause: NotificationCause | null;
  alertDayId: string;
  recipientId: string;
  subjectId: string | null;
  title: string;
  body: string;
  href: string;
  availableAt: Date;
  expiresAt: Date;
}

export function alertMorningAt(date: string): Date {
  return new Date(`${date}T08:00:00+09:00`);
}

export function alertDayEndsAt(date: string): Date {
  return new Date(`${date}T23:59:59.999+09:00`);
}

function kstDateOf(value: Date): string {
  return new Date(value.getTime() + 9 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
}

/** 과거 날짜 수동 데모는 즉시 보여 주되, 생성한 현재 KST 날짜를 넘겨 늦게 보내지 않는다. */
export function notificationExpiresAt(date: string, availableAt: Date): Date {
  const alertDayEnd = alertDayEndsAt(date);
  const deliveryDayEnd = alertDayEndsAt(kstDateOf(availableAt));
  return alertDayEnd > deliveryDayEnd ? alertDayEnd : deliveryDayEnd;
}

function queryHref(path: string, values: Record<string, string>): string {
  const query = new URLSearchParams(values);
  return `${path}?${query.toString()}`;
}

/** 잠금 화면에는 합성 데이터라도 전체 이름을 싣지 않는다. */
export function maskSubjectName(name: string): string {
  const characters = Array.from(name.trim());
  if (characters.length <= 1) return characters[0] ?? "대상자";
  return `${characters[0]}${"○".repeat(characters.length - 1)}`;
}

export function morningSummaryDraft(input: {
  alertDayId: string;
  date: string;
  level: AlertLevel;
  recipientId: string;
  criticalCount: number;
  totalCount: number;
  availableAt: Date;
}): NotificationDraft {
  const callCount = Math.max(0, input.totalCount - input.criticalCount);
  const body =
    input.criticalCount > 0 && callCount > 0
      ? `1등급 ${input.criticalCount}명은 오전 방문, 나머지 ${callCount}명은 전화 확인이 필요합니다.`
      : input.criticalCount > 0
        ? `1등급 ${input.criticalCount}명은 오전 방문이 필요합니다.`
        : `${callCount}명은 오늘 전화 확인이 필요합니다.`;

  return {
    eventKey: `${NotificationType.ALERT_DAY_SUMMARY}:${input.alertDayId}:${input.recipientId}`,
    type: NotificationType.ALERT_DAY_SUMMARY,
    cause: null,
    alertDayId: input.alertDayId,
    recipientId: input.recipientId,
    subjectId: null,
    title: `오늘은 폭염 ${ALERT_LEVEL_LABEL[input.level]} 단계입니다`,
    body,
    href: queryHref("/today", {
      date: input.date,
      workerId: input.recipientId,
    }),
    availableAt: input.availableAt,
    expiresAt: notificationExpiresAt(input.date, input.availableAt),
  };
}

export function visitPromotedDraft(input: {
  alertDayId: string;
  date: string;
  recipientId: string;
  subjectId: string;
  subjectName: string;
  workerId: string;
  cause: NotificationCause;
  availableAt: Date;
}): NotificationDraft {
  return {
    eventKey: `${NotificationType.VISIT_PROMOTED}:${input.alertDayId}:${input.subjectId}:${input.recipientId}`,
    type: NotificationType.VISIT_PROMOTED,
    cause: input.cause,
    alertDayId: input.alertDayId,
    recipientId: input.recipientId,
    subjectId: input.subjectId,
    title: "방문 확인 대상이 추가됐습니다",
    body: `${maskSubjectName(input.subjectName)} 대상자가 ${NOTIFICATION_CAUSE_LABEL[input.cause]} 방문 대기 상태가 됐습니다.`,
    href: queryHref(`/today/${input.subjectId}`, {
      date: input.date,
      workerId: input.workerId,
    }),
    availableAt: input.availableAt,
    expiresAt: notificationExpiresAt(input.date, input.availableAt),
  };
}
