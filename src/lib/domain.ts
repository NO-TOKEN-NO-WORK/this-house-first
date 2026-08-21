/**
 * 도메인 상수·타입의 단일 원본.
 *
 * SQLite에는 enum이 없어 DB는 상태값을 String으로 저장한다 (ADR-0004).
 * 따라서 코드 전체에서 상태값 문자열 하드코딩을 금지하고, 반드시 이 파일의
 * 상수만 사용한다 (ADR-0002, AGENTS.md 도메인 규칙 2).
 */

/** 경보 단계 (PRD F1) — 매일 17시 판정, 임계값 미달 시 시스템 침묵 */
export const AlertLevel = {
  /** 주의: 폭염특보 수준 */
  ADVISORY: "ADVISORY",
  /** 경보: 체감 35도+ */
  WARNING: "WARNING",
  /** 비상: 중대경보, 체감 38도+ */
  EMERGENCY: "EMERGENCY",
} as const;
export type AlertLevel = (typeof AlertLevel)[keyof typeof AlertLevel];

export const ALERT_LEVEL_LABEL: Record<AlertLevel, string> = {
  ADVISORY: "주의",
  WARNING: "경보",
  EMERGENCY: "비상",
};

/** 위험 등급 (PRD F2) — 1: 초고위험(전화 생략, 오전 방문) / 2: 고위험(오전 전화) / 3: 중위험(15시 이전 전화) */
export const RiskGrade = {
  CRITICAL: 1,
  HIGH: 2,
  MODERATE: 3,
} as const;
export type RiskGrade = (typeof RiskGrade)[keyof typeof RiskGrade];

/** 담당자 역할 (PRD §4) */
export const WorkerRole = {
  /** 생활지원사 */
  WORKER: "WORKER",
  /** 전담사회복지사 / 시군 복지과 */
  MANAGER: "MANAGER",
} as const;
export type WorkerRole = (typeof WorkerRole)[keyof typeof WorkerRole];

/** 가구별·경보일별 상태머신 (PRD F4·F5, docs/architecture.md §4) */
export const HouseholdStatus = {
  /** 미확인 */
  UNCHECKED: "UNCHECKED",
  /** 전화 확인 완료(정상) */
  CALL_OK: "CALL_OK",
  /** 무응답 1회 — 30분 후 재전화 */
  NO_ANSWER_1: "NO_ANSWER_1",
  /** 방문 큐 승격 (무응답 2회 / 이상 징후 / 1등급 즉시) */
  VISIT_QUEUED: "VISIT_QUEUED",
  /** 방문 중 */
  VISITING: "VISITING",
  /** 조치 완료 (정상 확인 포함) */
  RESOLVED: "RESOLVED",
  /** 119 연계 */
  EMERGENCY_119: "EMERGENCY_119",
  /** 연락두절 */
  UNREACHABLE: "UNREACHABLE",
} as const;
export type HouseholdStatus =
  (typeof HouseholdStatus)[keyof typeof HouseholdStatus];

export const HOUSEHOLD_STATUS_LABEL: Record<HouseholdStatus, string> = {
  UNCHECKED: "미확인",
  CALL_OK: "전화 확인",
  NO_ANSWER_1: "무응답 1회",
  VISIT_QUEUED: "방문 대기",
  VISITING: "방문 중",
  RESOLVED: "조치 완료",
  EMERGENCY_119: "119 연계",
  UNREACHABLE: "연락두절",
};

/** 확인 기록 종류 */
export const CheckKind = {
  CALL: "CALL",
  VISIT: "VISIT",
} as const;
export type CheckKind = (typeof CheckKind)[keyof typeof CheckKind];

/** 전화 결과 원터치 기록 (PRD F4) */
export const CallResult = {
  OK: "OK",
  NO_ANSWER: "NO_ANSWER",
  /** 이상 징후 → 즉시 방문 큐 승격 */
  SYMPTOM: "SYMPTOM",
  UNREACHABLE: "UNREACHABLE",
} as const;
export type CallResult = (typeof CallResult)[keyof typeof CallResult];

/** 방문 결과 기록 (PRD F4) */
export const VisitResult = {
  OK: "OK",
  /** 조치함 (냉방 가동·수분 등) */
  ACTED: "ACTED",
  /** 119 연계 */
  EMERGENCY_119: "EMERGENCY_119",
  /** 에어컨 없음·고장 → 익일 위험도 가중(FR-8) + 지원사업 연계 플래그(FR-11) */
  AIRCON_ISSUE: "AIRCON_ISSUE",
} as const;
export type VisitResult = (typeof VisitResult)[keyof typeof VisitResult];
