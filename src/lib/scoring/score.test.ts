import { describe, expect, it } from "vitest";
import { AlertLevel, RiskGrade } from "../domain";
import { assessRisk } from "./score";

/** PRD §7 참고 시나리오 기반 검증. 기준 연도는 2026으로 고정 (순수 함수). */
const YEAR = 2026;

describe("assessRisk", () => {
  it("80세+·독거·1980년 이전 단독주택·비상일 → 1등급 (PRD F3의 전형적 1등급)", () => {
    const r = assessRisk({
      subject: { birthYear: 1938, livesAlone: true },
      building: { isDetached: true, builtYear: 1972, structure: "슬레이트" },
      level: AlertLevel.EMERGENCY,
      feelsLikeMax: 38,
      year: YEAR,
    });
    // 3.0(80+) × 1.5(독거) × 1.4(단독) × 2.0(1980년 이전) × 2.5(비상) = 31.5
    expect(r.score).toBe(31.5);
    expect(r.grade).toBe(RiskGrade.CRITICAL);
  });

  it("65~74세·비독거·2000년 이후 공동주택·주의일 → 3등급", () => {
    const r = assessRisk({
      subject: { birthYear: 1958, livesAlone: false },
      building: { isDetached: false, builtYear: 2010 },
      level: AlertLevel.ADVISORY,
      year: YEAR,
    });
    expect(r.score).toBe(1);
    expect(r.grade).toBe(RiskGrade.MODERATE);
  });

  it("거동불편/기저질환은 ×2.0 (Vandentorren 2006 OR 7.5 반영)", () => {
    const base = {
      subject: { birthYear: 1950, livesAlone: false },
      building: { isDetached: false },
      level: AlertLevel.WARNING,
      year: YEAR,
    };
    const without = assessRisk(base);
    const withIssue = assessRisk({
      ...base,
      subject: { ...base.subject, hasMobilityIssue: true },
    });
    expect(withIssue.score).toBe(without.score * 2);
  });

  it("에어컨 고장 플래그는 익일 위험도를 가중한다 (FR-8)", () => {
    const base = {
      subject: { birthYear: 1940, livesAlone: true },
      building: { isDetached: true, builtYear: 1975 },
      level: AlertLevel.WARNING,
      year: YEAR,
    };
    const before = assessRisk(base);
    const after = assessRisk({
      ...base,
      subject: { ...base.subject, airconBroken: true },
    });
    expect(after.score).toBeGreaterThan(before.score);
    expect(after.reasons.join()).toContain("에어컨");
  });

  it("위험 사유(reasons)는 개인·건물·기상 순으로 사람이 읽을 수 있게 반환된다 (F3)", () => {
    const r = assessRisk({
      subject: { birthYear: 1938, livesAlone: true },
      building: { isDetached: true, builtYear: 1972, structure: "슬레이트" },
      level: AlertLevel.EMERGENCY,
      feelsLikeMax: 38,
      year: YEAR,
    });
    expect(r.reasons).toEqual([
      "1938년생 (88세)·독거",
      "1972년 단독주택 슬레이트",
      "오늘 비상 단계 (체감 38도)",
    ]);
  });

  it("데이터 없음(null)은 가중하지 않는다 — 최상층·기저질환 미상", () => {
    const r = assessRisk({
      subject: { birthYear: 1945, livesAlone: false, hasMobilityIssue: null },
      building: { isDetached: false, builtYear: null },
      level: AlertLevel.ADVISORY,
      year: YEAR,
    });
    // 3.0(80+) × 1.0 × 1.0 = 3.0 — 건물 정보가 없으면 건물 가중 없음
    expect(r.score).toBe(3);
  });
});
