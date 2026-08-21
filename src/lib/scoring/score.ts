import { AlertLevel, ALERT_LEVEL_LABEL, RiskGrade } from "../domain";
import {
  AIRCON_BROKEN,
  BUILDING,
  GRADE_CUTOFF,
  PERSONAL,
  WEATHER,
} from "./weights";

/**
 * 위험도 스코어링 엔진 (FR-3, ADR-0005)
 *
 * 순수 함수로 유지한다 — DB·네트워크·현재 시각에 의존하지 않는다.
 * UI에 표시되는 위험 사유는 반드시 이 엔진이 반환한 reasons를 그대로 쓴다
 * (설명 가능성 — PRD F3 "설명 가능성이 신뢰의 조건").
 */

export interface RiskInput {
  subject: {
    birthYear: number;
    livesAlone: boolean;
    /** null/undefined = 데이터 없음 (가중 미적용) */
    hasMobilityIssue?: boolean | null;
    hasChronicDisease?: boolean | null;
    /** 방문 기록으로 발견된 에어컨 없음·고장 (FR-8) */
    airconBroken?: boolean;
  };
  building: {
    isDetached: boolean;
    builtYear?: number | null;
    /** 사유 표시용 구조명 (예: "슬레이트") */
    structure?: string | null;
    hasTopFloorUnit?: boolean;
  };
  /** 당일 경보 단계 (F1 트리거 결과) */
  level: AlertLevel;
  /** 사유 표시용 당일 최고 체감온도 */
  feelsLikeMax?: number;
  /** 나이 계산 기준 연도 — 호출부에서 주입 (순수성 유지) */
  year: number;
}

export interface RiskResult {
  /** 위험점수 = W_개인 × W_건물 × W_기상 (소수 1자리 반올림) */
  score: number;
  grade: RiskGrade;
  /** 대상자 카드에 그대로 표시할 위험 사유 (예: "1938년생 (88세)·독거") */
  reasons: string[];
}

export function assessRisk(input: RiskInput): RiskResult {
  const { subject, building, level, feelsLikeMax, year } = input;
  const reasons: string[] = [];

  // W_개인
  const age = year - subject.birthYear;
  let personal =
    age >= 80 ? PERSONAL.AGE_80_PLUS : age >= 75 ? PERSONAL.AGE_75_79 : PERSONAL.AGE_65_74;
  let personalReason = `${subject.birthYear}년생 (${age}세)`;
  if (subject.livesAlone) {
    personal *= PERSONAL.LIVES_ALONE;
    personalReason += "·독거";
  }
  if (subject.hasMobilityIssue || subject.hasChronicDisease) {
    personal *= PERSONAL.MOBILITY_OR_CHRONIC;
    personalReason += "·거동불편/기저질환";
  }
  if (subject.airconBroken) {
    personal *= AIRCON_BROKEN;
    personalReason += "·에어컨 없음/고장";
  }
  reasons.push(personalReason);

  // W_건물
  let bldg = 1.0;
  const parts: string[] = [];
  if (building.builtYear != null) {
    if (building.builtYear < 1980) bldg *= BUILDING.BUILT_BEFORE_1980;
    else if (building.builtYear < 2000) bldg *= BUILDING.BUILT_1980_1999;
    parts.push(`${building.builtYear}년`);
  }
  if (building.isDetached) {
    bldg *= BUILDING.DETACHED_HOUSE;
    parts.push("단독주택");
  }
  if (building.structure) parts.push(building.structure);
  if (building.hasTopFloorUnit) {
    bldg *= BUILDING.TOP_FLOOR;
    parts.push("최상층/옥탑");
  }
  if (parts.length > 0) reasons.push(parts.join(" "));

  // W_기상
  const weather = WEATHER[level];
  reasons.push(
    `오늘 ${ALERT_LEVEL_LABEL[level]} 단계` +
      (feelsLikeMax != null ? ` (체감 ${feelsLikeMax}도)` : ""),
  );

  const score = Math.round(personal * bldg * weather * 10) / 10;
  return { score, grade: classifyGrade(score), reasons };
}

/** 등급 분류 — 컷오프는 weights.ts에서만 관리 (잠정치, D1 캘리브레이션 예정) */
export function classifyGrade(score: number): RiskGrade {
  if (score >= GRADE_CUTOFF.CRITICAL) return RiskGrade.CRITICAL;
  if (score >= GRADE_CUTOFF.HIGH) return RiskGrade.HIGH;
  return RiskGrade.MODERATE;
}
