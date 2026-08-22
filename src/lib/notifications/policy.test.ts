import { describe, expect, it } from "vitest";
import {
  AlertLevel,
  CallResult,
  HouseholdStatus,
  NotificationCause,
  RiskGrade,
} from "../domain";
import {
  morningSummaryDrafts,
  promotedCallCause,
  reclassificationRecipientIds,
} from "./policy";

describe("알림 생성 정책", () => {
  it("경보일 아침 요약을 담당자마다 정확히 1건 만든다", () => {
    const drafts = morningSummaryDrafts({
      alertDayId: "alert-1",
      date: "2026-08-22",
      level: AlertLevel.WARNING,
      availableAt: new Date("2026-08-21T23:00:00.000Z"),
      subjects: [
        { workerId: "worker-1", grade: RiskGrade.CRITICAL },
        { workerId: "worker-1", grade: RiskGrade.HIGH },
        { workerId: "worker-2", grade: RiskGrade.MODERATE },
      ],
    });

    expect(drafts).toHaveLength(2);
    expect(drafts.map(({ eventKey }) => eventKey)).toEqual([
      "ALERT_DAY_SUMMARY:alert-1:worker-1",
      "ALERT_DAY_SUMMARY:alert-1:worker-2",
    ]);
    expect(drafts[0]?.body).toContain("1등급 1명은 오전 방문");
  });

  it("초기 1등급은 승격 Push를 만들지 않고 재발령 승격만 담당자·관리자에게 보낸다", () => {
    expect(
      reclassificationRecipientIds({
        current: null,
        next: HouseholdStatus.VISIT_QUEUED,
        workerId: "worker-1",
        managerIds: ["manager-1"],
      }),
    ).toEqual([]);
    expect(
      reclassificationRecipientIds({
        current: HouseholdStatus.UNCHECKED,
        next: HouseholdStatus.VISIT_QUEUED,
        workerId: "worker-1",
        managerIds: ["manager-1"],
      }),
    ).toEqual(["worker-1", "manager-1"]);
  });

  it("무응답과 이상 징후만 승격 원인이 된다", () => {
    expect(promotedCallCause(CallResult.NO_ANSWER)).toBe(
      NotificationCause.NO_ANSWER_2,
    );
    expect(promotedCallCause(CallResult.SYMPTOM)).toBe(
      NotificationCause.SYMPTOM,
    );
    expect(promotedCallCause(CallResult.OK)).toBeNull();
  });
});
