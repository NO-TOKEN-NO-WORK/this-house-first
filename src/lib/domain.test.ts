import { describe, expect, it } from "vitest";
import {
  AlertLevel,
  CallResult,
  CheckKind,
  HouseholdStatus,
  isAlertLevel,
  isCallResult,
  isCheckKind,
  isHouseholdStatus,
  isRiskGrade,
  isVisitResult,
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
  });

  it("Object 프로토타입의 속성은 상태값으로 허용하지 않는다", () => {
    expect(isAlertLevel("toString")).toBe(false);
    expect(isAlertLevel("__proto__")).toBe(false);
    expect(isHouseholdStatus("toString")).toBe(false);
    expect(isHouseholdStatus("constructor")).toBe(false);
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

  it("Object 프로토타입 속성은 결과값으로 허용하지 않는다", () => {
    for (const bad of ["toString", "constructor", "__proto__"]) {
      expect(isCallResult(bad)).toBe(false);
      expect(isVisitResult(bad)).toBe(false);
      expect(isCheckKind(bad)).toBe(false);
    }
  });
});
