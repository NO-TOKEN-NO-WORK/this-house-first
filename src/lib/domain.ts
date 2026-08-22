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

/** 외부 입력(HTTP 본문·DB 문자열)이 유효한 경보 단계인지 검사 — SQLite에 enum이 없어 타입만으로는 못 막는다 */
export function isAlertLevel(value: unknown): value is AlertLevel {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ALERT_LEVEL_LABEL, value)
  );
}

/** 위험 등급 (PRD F2) — 1: 초고위험(전화 생략, 오전 방문) / 2: 고위험(오전 전화) / 3: 중위험(15시 이전 전화) */
export const RiskGrade = {
  CRITICAL: 1,
  HIGH: 2,
  MODERATE: 3,
} as const;
export type RiskGrade = (typeof RiskGrade)[keyof typeof RiskGrade];

export const GRADE_LABEL: Record<RiskGrade, string> = {
  1: "1등급",
  2: "2등급",
  3: "3등급",
};

/**
 * 등급별 대응 지시 (PRD F3) — 담당자 화면이 그대로 표시한다.
 * 1등급에 전화가 없는 것은 누락이 아니라 설계다: 전화로 '괜찮다'를 신뢰할 수 없는 군이라
 * 허위 안심을 원천 차단한다 (PRD §12 리스크 대응).
 */
export const GRADE_PLAN: Record<RiskGrade, string> = {
  1: "전화 생략 · 오전 방문",
  2: "오전 중 전화",
  3: "15시 이전 전화",
};

/**
 * 등급 + 위험도 한 줄 표기 — 대상자 상세 화면의 배지에 그대로 쓴다 (Figma ② 3:529).
 * 위험도 문구는 RiskGrade 주석의 정의(1: 초고위험 / 2: 고위험 / 3: 중위험)와 같은 값이다.
 * 등급 숫자만 보면 "1등급이 제일 위험한가?"를 담당자가 매번 되묻게 되므로 배지에서 함께 읽힌다.
 */
export const GRADE_SEVERITY_LABEL: Record<RiskGrade, string> = {
  1: "1등급 초고위험",
  2: "2등급 고위험",
  3: "3등급 중위험",
};

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

/**
 * 아직 담당자의 손이 필요한 상태 — 그날의 목표는 이 수가 0이 되는 것이다 (PRD §11 북극성).
 * 전화 확인·조치 완료·119 연계·연락두절은 그날 할 일이 끝난 것으로 본다.
 */
const OPEN_STATUSES: readonly HouseholdStatus[] = [
  HouseholdStatus.UNCHECKED,
  HouseholdStatus.NO_ANSWER_1,
  HouseholdStatus.VISIT_QUEUED,
  HouseholdStatus.VISITING,
];

export function isOpenHouseholdStatus(status: HouseholdStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function isHouseholdStatus(value: unknown): value is HouseholdStatus {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(HOUSEHOLD_STATUS_LABEL, value)
  );
}

/**
 * DB의 String 컬럼을 상태값으로 되읽을 때 쓴다.
 * 알 수 없는 값이면 던진다 — 조용히 UNCHECKED로 떨어뜨리면 진행 중인 가구를 미확인으로
 * 되돌리는 사고가 난다 (SQLite에 enum이 없어 여기가 유일한 방어선, ADR-0004).
 */
export function parseHouseholdStatus(value: string): HouseholdStatus {
  if (!isHouseholdStatus(value)) {
    throw new Error(`알 수 없는 가구 상태값입니다: ${value}`);
  }
  return value;
}

/** 확인 기록 종류 */
export const CheckKind = {
  CALL: "CALL",
  VISIT: "VISIT",
} as const;
export type CheckKind = (typeof CheckKind)[keyof typeof CheckKind];

export function isCheckKind(value: unknown): value is CheckKind {
  return value === CheckKind.CALL || value === CheckKind.VISIT;
}

/** 전화 결과 원터치 기록 (PRD F4) */
export const CallResult = {
  OK: "OK",
  NO_ANSWER: "NO_ANSWER",
  /** 이상 징후 → 즉시 방문 큐 승격 */
  SYMPTOM: "SYMPTOM",
  UNREACHABLE: "UNREACHABLE",
} as const;
export type CallResult = (typeof CallResult)[keyof typeof CallResult];

/** 원터치 기록 버튼에 그대로 쓰는 라벨 — UI에서 문자열을 다시 쓰지 않는다 */
export const CALL_RESULT_LABEL: Record<CallResult, string> = {
  OK: "정상",
  NO_ANSWER: "무응답",
  SYMPTOM: "이상 징후",
  UNREACHABLE: "연락두절",
};

export function isCallResult(value: unknown): value is CallResult {
  // `in`은 프로토타입 체인까지 본다 — "toString"이 통과하면 DB에 쓰레기 결과값이 들어간다
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CALL_RESULT_LABEL, value)
  );
}

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

export const VISIT_RESULT_LABEL: Record<VisitResult, string> = {
  OK: "정상",
  ACTED: "조치함",
  EMERGENCY_119: "119 연계",
  AIRCON_ISSUE: "에어컨 없음·고장",
};

export function isVisitResult(value: unknown): value is VisitResult {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(VISIT_RESULT_LABEL, value)
  );
}
