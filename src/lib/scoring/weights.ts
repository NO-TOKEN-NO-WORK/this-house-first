import { AlertLevel } from "../domain";

/**
 * 위험도 모델 v0 가중치 — 규칙 기반, ML 아님 (PRD §7, ADR-0005)
 *
 * ⚠️ 규칙 (AGENTS.md 도메인 규칙 1):
 *  - 가중치·임계값의 정의와 수정은 반드시 이 파일에서만 한다.
 *  - 모든 값에는 출처 주석을 단다. 출처가 없는 값은 `잠정` 주석을 명시한다.
 *
 * 위험점수 = W_개인 × W_건물 × W_기상 (곱셈형 — 위험 요인의 상호 증폭 반영)
 */

/** W_개인: 개인 취약도 */
export const PERSONAL = {
  /** 80세 이상 3.0 — 온열질환 사망의 62%가 80세 이상 (복지부·질병청 2026.8, PRD P1) */
  AGE_80_PLUS: 3.0,
  /** 75~79세 2.0 (PRD §7) */
  AGE_75_79: 2.0,
  /** 65~74세 1.0 — 기준값 (PRD §7) */
  AGE_65_74: 1.0,
  /** 독거 ×1.5 — 프랑스 2003 폭염에서 사회적 고립이 고위험 요인 (Fouillet 2008, PRD P6) */
  LIVES_ALONE: 1.5,
  /** 거동불편/기저질환 ×2.0, 데이터 있을 시 — OR 7.5 (Vandentorren 2006, PRD P2) */
  MOBILITY_OR_CHRONIC: 2.0,
} as const;

/** W_건물: 건물 취약도 (건축물대장 기반, FR-2) */
export const BUILDING = {
  /** 단독주택 ×1.4 — 건축공간연구원 1.4배 (PRD §7) */
  DETACHED_HOUSE: 1.4,
  /** 1980년 이전 건축 ×2.0 — 단열 부재가 주거요인 1위, 1975년 이전 위험 (Vandentorren 2006, PRD P2) */
  BUILT_BEFORE_1980: 2.0,
  /** 1980~1999년 건축 ×1.5 (PRD §7) */
  BUILT_1980_1999: 1.5,
  /** 최상층/옥탑 ×2.0, 데이터 있을 시 — 꼭대기층 OR 4.1 (Vandentorren 2006, PRD P2) */
  TOP_FLOOR: 2.0,
} as const;

/** W_기상: 당일 기상계수 — 체감 38도 시 노인 사망위험 +19% (질병청, PRD P2) */
export const WEATHER: Record<AlertLevel, number> = {
  [AlertLevel.ADVISORY]: 1.0,
  [AlertLevel.WARNING]: 1.5,
  [AlertLevel.EMERGENCY]: 2.5,
};

/**
 * 폭염 운영 단계 임계값 (PRD F1).
 * 출처: 기상청 2026 폭염특보 개편 — 주의보 체감 33℃, 경보 체감 35℃,
 * 중대경보 체감 38℃ 또는 기온 39℃. 실제 주의보·경보는 2일 지속 조건이 있으나,
 * 본 앱은 익일 대응 강도를 정하기 위해 일 최고 예보값을 사용한다.
 */
export const HEAT_ALERT_THRESHOLD = {
  ADVISORY_FEELS_LIKE: 33,
  WARNING_FEELS_LIKE: 35,
  EMERGENCY_FEELS_LIKE: 38,
  EMERGENCY_AIR_TEMPERATURE: 39,
} as const;

/**
 * 단계별 최소 체감온도 — HEAT_ALERT_THRESHOLD에서 파생한 조회표이며 새 임계값이 아니다.
 * 수동 발령(ADR-0011 데모 시뮬레이션)에서 체감온도를 생략했을 때 기본값으로 쓴다.
 */
export const LEVEL_MIN_FEELS_LIKE: Record<AlertLevel, number> = {
  [AlertLevel.ADVISORY]: HEAT_ALERT_THRESHOLD.ADVISORY_FEELS_LIKE,
  [AlertLevel.WARNING]: HEAT_ALERT_THRESHOLD.WARNING_FEELS_LIKE,
  [AlertLevel.EMERGENCY]: HEAT_ALERT_THRESHOLD.EMERGENCY_FEELS_LIKE,
};

/**
 * 에어컨 없음·고장 가중 (FR-8: 방문 기록 → 익일 위험도 반영)
 * ⚠️ 잠정 1.5 — PRD에 수치 근거 없음. 합성 데이터 분포 확인 후 팀 캘리브레이션 필요.
 */
export const AIRCON_BROKEN = 1.5;

/**
 * 위험 단계 컷오프 — score >= CRITICAL이면 심각, >= HIGH이면 경계, 그 외 주의.
 * ⚠️ 잠정 — PRD에 컷오프 근거 없음(ADR-0005 결과 항목). 수치 자체의 문헌 출처는 없다.
 *
 * 캘리브레이션 (2026-08-22, 시드 실데이터: 대구 서구 비산동 건축물대장 10동 × 합성 15명):
 *   심각일  심각 3 · 경계 5 · 주의 7   ← 심각 = 전화 생략·방문 대상. 담당자 방문 처리 능력 ~4가구/일(PRD P3) 이내
 *   경계일  심각 2 · 경계 5 · 주의 8
 *   주의일  심각 1 · 경계 2 · 주의 12
 *   점수 범위: 63(86세·독거·거동불편·1959 목조) ~ 2.5(73세·2002 공동주택). 경계 근처: 23.6 / [25] / 31.5, 7.5 / [10] / 10.5
 * 컷오프 변경 시 `npm run db:seed`가 출력하는 분포로 재확인한다.
 */
export const GRADE_CUTOFF = {
  CRITICAL: 25,
  HIGH: 10,
} as const;
