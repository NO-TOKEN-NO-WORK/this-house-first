import { describe, expect, it } from "vitest";
import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  CallResult,
  CheckKind,
  GRADE_LABEL,
  GRADE_SEVERITY_LABEL,
  HouseholdStatus,
  isAlertLevel,
  isCallResult,
  isCheckKind,
  isHouseholdStatus,
  isNotificationCause,
  isNotificationType,
  isRiskGrade,
  isVisitResult,
  nextCheckKindOf,
  NotificationCause,
  NOTIFICATION_CAUSE_LABEL,
  NotificationType,
  parseHouseholdStatus,
  RiskGrade,
  VisitResult,
} from "./domain";

describe("도메인 상태값 검증", () => {
  it("정의된 경보 단계와 가구 상태만 허용한다", () => {
    expect(isAlertLevel(AlertLevel.ADVISORY)).toBe(true);
    expect(isHouseholdStatus(HouseholdStatus.UNCHECKED)).toBe(true);
    expect(isRiskGrade(RiskGrade.CRITICAL)).toBe(true);
    expect(isRiskGrade(4)).toBe(false);
    expect(isRiskGrade("1")).toBe(false);
    expect(isNotificationType(NotificationType.ALERT_DAY_SUMMARY)).toBe(true);
    expect(isNotificationCause(NotificationCause.SYMPTOM)).toBe(true);
  });

  it("경보 단계 화면 문구는 주의·경계·비상이다", () => {
    expect(ALERT_LEVEL_LABEL[AlertLevel.ADVISORY]).toBe("주의");
    expect(ALERT_LEVEL_LABEL[AlertLevel.WARNING]).toBe("경계");
    expect(ALERT_LEVEL_LABEL[AlertLevel.EMERGENCY]).toBe("비상");
  });

  it("대상자 위험 단계 화면 문구는 심각·경계·주의이다", () => {
    expect(GRADE_LABEL[RiskGrade.CRITICAL]).toBe("심각");
    expect(GRADE_LABEL[RiskGrade.HIGH]).toBe("경계");
    expect(GRADE_LABEL[RiskGrade.MODERATE]).toBe("주의");
    expect(GRADE_SEVERITY_LABEL[RiskGrade.CRITICAL]).toBe("심각 초고위험");
    expect(GRADE_SEVERITY_LABEL[RiskGrade.HIGH]).toBe("경계 고위험");
    expect(GRADE_SEVERITY_LABEL[RiskGrade.MODERATE]).toBe("주의 중위험");
  });

  it("재분류 승격 원인은 경보 단계와 구분해 위험 단계로 표시한다", () => {
    expect(NOTIFICATION_CAUSE_LABEL[NotificationCause.RISK_RECLASSIFIED]).toBe(
      "위험 단계 상승으로",
    );
  });

  it("Object 프로토타입의 속성은 상태값으로 허용하지 않는다", () => {
    expect(isAlertLevel("toString")).toBe(false);
    expect(isAlertLevel("__proto__")).toBe(false);
    expect(isHouseholdStatus("toString")).toBe(false);
    expect(isHouseholdStatus("constructor")).toBe(false);
    expect(isNotificationType("toString")).toBe(false);
    expect(isNotificationCause("__proto__")).toBe(false);
    expect(() => parseHouseholdStatus("toString")).toThrow(
      "알 수 없는 가구 상태값",
    );
  });
});

describe("확인 기록 값 검증", () => {
  it("정의된 기록 종류·결과만 허용한다", () => {
    expect(isCheckKind(CheckKind.CALL)).toBe(true);
    expect(isCallResult(CallResult.NO_ANSWER)).toBe(true);
    expect(isVisitResult(VisitResult.AIRCON_ISSUE)).toBe(true);
  });

  it("전화 결과와 방문 결과는 서로 섞이지 않는다", () => {
    // 값이 겹치는 것(OK)과 겹치지 않는 것(NO_ANSWER / ACTED)을 모두 확인한다
    expect(isVisitResult(CallResult.NO_ANSWER)).toBe(false);
    expect(isCallResult(VisitResult.ACTED)).toBe(false);
  });

  it("가구 상태에서 다음에 받을 기록 종류를 정한다", () => {
    expect(nextCheckKindOf(HouseholdStatus.UNCHECKED)).toBe(CheckKind.CALL);
    expect(nextCheckKindOf(HouseholdStatus.NO_ANSWER_1)).toBe(CheckKind.CALL);
    expect(nextCheckKindOf(HouseholdStatus.VISIT_QUEUED)).toBe(CheckKind.VISIT);
    expect(nextCheckKindOf(HouseholdStatus.VISITING)).toBe(CheckKind.VISIT);
    expect(nextCheckKindOf(HouseholdStatus.CALL_OK)).toBeNull();
    expect(nextCheckKindOf(HouseholdStatus.RESOLVED)).toBeNull();
    expect(nextCheckKindOf(HouseholdStatus.EMERGENCY_119)).toBeNull();
    expect(nextCheckKindOf(HouseholdStatus.UNREACHABLE)).toBeNull();
  });

  it("Object 프로토타입 속성은 결과값으로 허용하지 않는다", () => {
    for (const bad of ["toString", "constructor", "__proto__"]) {
      expect(isCallResult(bad)).toBe(false);
      expect(isVisitResult(bad)).toBe(false);
      expect(isCheckKind(bad)).toBe(false);
    }
  });
});
