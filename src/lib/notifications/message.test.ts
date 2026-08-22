import { describe, expect, it } from "vitest";
import {
  AlertLevel,
  NotificationCause,
  NotificationType,
} from "../domain";
import {
  alertDayEndsAt,
  alertMorningAt,
  maskSubjectName,
  morningSummaryDraft,
  notificationExpiresAt,
  visitPromotedDraft,
} from "./message";

describe("알림 문구", () => {
  it("경보일 오전 8시를 KST 기준 절대 시각으로 만든다", () => {
    expect(alertMorningAt("2026-08-22").toISOString()).toBe(
      "2026-08-21T23:00:00.000Z",
    );
    expect(alertDayEndsAt("2026-08-22").toISOString()).toBe(
      "2026-08-22T14:59:59.999Z",
    );
    expect(
      notificationExpiresAt(
        "2026-08-21",
        new Date("2026-08-22T01:00:00.000Z"),
      ).toISOString(),
    ).toBe("2026-08-22T14:59:59.999Z");
  });

  it("담당자별 아침 요약은 경보일·담당자 고유키와 대응 건수를 담는다", () => {
    const draft = morningSummaryDraft({
      alertDayId: "alert-1",
      date: "2026-08-22",
      level: AlertLevel.EMERGENCY,
      recipientId: "worker-1",
      criticalCount: 2,
      totalCount: 15,
      availableAt: alertMorningAt("2026-08-22"),
    });

    expect(draft.eventKey).toBe("ALERT_DAY_SUMMARY:alert-1:worker-1");
    expect(draft.type).toBe(NotificationType.ALERT_DAY_SUMMARY);
    expect(draft.title).toBe("오늘은 폭염 비상 단계입니다");
    expect(draft.body).toContain("심각 2명은 오전 방문");
    expect(draft.href).toBe("/today?date=2026-08-22&workerId=worker-1");
    expect(draft.expiresAt.toISOString()).toBe("2026-08-22T14:59:59.999Z");
  });

  it("승격 알림은 이름을 가리고 도메인 원인을 그대로 표시한다", () => {
    const draft = visitPromotedDraft({
      alertDayId: "alert-1",
      date: "2026-08-22",
      recipientId: "manager-1",
      subjectId: "subject-1",
      subjectName: "박영희",
      workerId: "worker-1",
      cause: NotificationCause.NO_ANSWER_2,
      availableAt: new Date("2026-08-22T01:00:00.000Z"),
    });

    expect(draft.eventKey).toBe(
      "VISIT_PROMOTED:alert-1:subject-1:manager-1",
    );
    expect(draft.body).toBe(
      "박○○ 대상자가 무응답 2회로 방문 대기 상태가 됐습니다.",
    );
    expect(draft.href).toBe(
      "/today/subject-1?date=2026-08-22&workerId=worker-1",
    );
  });

  it("한 글자 이름과 빈 이름도 잠금 화면에서 안전하게 처리한다", () => {
    expect(maskSubjectName("한")).toBe("한");
    expect(maskSubjectName(" ")).toBe("대상자");
  });
});
