import { describe, expect, it } from "vitest";
import { HouseholdStatus, RiskGrade } from "../domain";
import { initialHouseholdStatus, resolveStatusOnDeclare } from "./initial";

describe("initialHouseholdStatus", () => {
  it("1등급은 전화를 생략하고 즉시 방문 대상이다 (PRD F3)", () => {
    expect(initialHouseholdStatus(RiskGrade.CRITICAL)).toBe(
      HouseholdStatus.VISIT_QUEUED,
    );
  });

  it("2·3등급은 미확인으로 시작해 전화 확인을 거친다", () => {
    expect(initialHouseholdStatus(RiskGrade.HIGH)).toBe(HouseholdStatus.UNCHECKED);
    expect(initialHouseholdStatus(RiskGrade.MODERATE)).toBe(
      HouseholdStatus.UNCHECKED,
    );
  });
});

describe("resolveStatusOnDeclare", () => {
  it("해당 경보일에 행이 없으면 초기 상태를 만든다", () => {
    expect(resolveStatusOnDeclare(null, RiskGrade.CRITICAL)).toBe(
      HouseholdStatus.VISIT_QUEUED,
    );
    expect(resolveStatusOnDeclare(null, RiskGrade.HIGH)).toBe(
      HouseholdStatus.UNCHECKED,
    );
  });

  it("재발령으로 1등급이 된 미확인 가구는 방문 큐로 승격한다 (주의→비상 상승)", () => {
    expect(
      resolveStatusOnDeclare(HouseholdStatus.UNCHECKED, RiskGrade.CRITICAL),
    ).toBe(HouseholdStatus.VISIT_QUEUED);
  });

  it("미확인 + 2·3등급은 그대로 둔다", () => {
    expect(resolveStatusOnDeclare(HouseholdStatus.UNCHECKED, RiskGrade.HIGH)).toBeNull();
    expect(
      resolveStatusOnDeclare(HouseholdStatus.UNCHECKED, RiskGrade.MODERATE),
    ).toBeNull();
  });

  it("이미 진행된 기록은 재발령해도 보존한다 — 그날의 확인 이력이 사라지면 안 된다", () => {
    const inProgress = [
      HouseholdStatus.CALL_OK,
      HouseholdStatus.NO_ANSWER_1,
      HouseholdStatus.VISIT_QUEUED,
      HouseholdStatus.VISITING,
      HouseholdStatus.RESOLVED,
      HouseholdStatus.EMERGENCY_119,
      HouseholdStatus.UNREACHABLE,
    ];
    for (const status of inProgress) {
      expect(resolveStatusOnDeclare(status, RiskGrade.CRITICAL)).toBeNull();
      expect(resolveStatusOnDeclare(status, RiskGrade.MODERATE)).toBeNull();
    }
  });
});
