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
  /** 경계: 체감 35도+ */
  WARNING: "WARNING",
  /** 심각: 중대경보, 체감 38도+ */
  EMERGENCY: "EMERGENCY",
} as const;
export type AlertLevel = (typeof AlertLevel)[keyof typeof AlertLevel];

export const ALERT_LEVEL_LABEL: Record<AlertLevel, string> = {
  ADVISORY: "주의",
  WARNING: "경계",
  EMERGENCY: "심각",
};

/** 외부 입력(HTTP 본문·DB 문자열)이 유효한 경보 단계인지 검사 — SQLite에 enum이 없어 타입만으로는 못 막는다 */
export function isAlertLevel(value: unknown): value is AlertLevel {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ALERT_LEVEL_LABEL, value)
  );
}

/** 위험 단계 (PRD F2) — 심각: 초고위험(전화 생략, 오전 방문) / 경계: 고위험(오전 전화) / 주의: 중위험(15시 이전 전화) */
export const RiskGrade = {
  CRITICAL: 1,
  HIGH: 2,
  MODERATE: 3,
} as const;
export type RiskGrade = (typeof RiskGrade)[keyof typeof RiskGrade];

export const GRADE_LABEL: Record<RiskGrade, string> = {
  1: "심각",
  2: "경계",
  3: "주의",
};

export function isRiskGrade(value: unknown): value is RiskGrade {
  return (
    value === RiskGrade.CRITICAL ||
    value === RiskGrade.HIGH ||
    value === RiskGrade.MODERATE
  );
}

/**
 * 위험 단계별 대응 지시 (PRD F3) — 담당자 화면이 그대로 표시한다.
 * 심각 단계에 전화가 없는 것은 누락이 아니라 설계다: 전화로 '괜찮다'를 신뢰할 수 없는 군이라
 * 허위 안심을 원천 차단한다 (PRD §12 리스크 대응).
 */
export const GRADE_PLAN: Record<RiskGrade, string> = {
  1: "전화 생략 · 오전 방문",
  2: "오전 중 전화",
  3: "15시 이전 전화",
};

/**
 * 전화 확인 때 물어볼 것 — 전화 안내 다이얼로그가 그대로 읽어 준다 (Figma ④ 7:2599).
 *
 * 담당자가 무엇을 물을지 고민하지 않게 하는 것이 목적이다(PRD §9 — 화면당 결정 1개).
 * 세 질문은 위험 판단이 보는 축과 맞물려 있다:
 *  1. 냉방 가동 — 에어컨 없음·고장이 위험 가중치에 들어간다 (`scoring/weights.ts`, FR-8)
 *  2. 온열질환 초기 증상 — "고령자는 초기 증상 자기 인지 어려움" (질병청, PRD §12)
 *  3. 낮 외출 — 폭염 시간대 야외 활동이 가장 큰 급성 위험
 *
 * 폭염 기준이다. 한파를 넣을 때는 경보 종류로 갈라야 한다 (지금 범위는 폭염 — PRD §3).
 */
export const CALL_GUIDE_QUESTIONS: readonly string[] = [
  "선풍기나 에어컨 켜셨어요?",
  "어지럽거나 머리 아프진 않으세요?",
  "오늘 밭일이나 외출 나가세요?",
];

/**
 * 위험 단계 + 위험도 한 줄 표기 — 대상자 상세 화면의 배지에 그대로 쓴다 (Figma ② 3:529).
 * 위험도 문구는 RiskGrade 주석의 정의(심각: 초고위험 / 경계: 고위험 / 주의: 중위험)와 같은 값이다.
 */
export const GRADE_SEVERITY_LABEL: Record<RiskGrade, string> = {
  1: "심각 초고위험",
  2: "경계 고위험",
  3: "주의 중위험",
};

/** 담당자 역할 (PRD §4) */
export const WorkerRole = {
  /** 생활지원사 */
  WORKER: "WORKER",
  /** 전담사회복지사 / 시군 복지과 */
  MANAGER: "MANAGER",
} as const;
export type WorkerRole = (typeof WorkerRole)[keyof typeof WorkerRole];

/** 사용자에게 전달하는 알림 사건 — 비경보일에는 어떤 값도 생성하지 않는다 (PRD §9, ADR-0017) */
export const NotificationType = {
  /** 경보일 오전 8시 담당자별 요약 1건 */
  ALERT_DAY_SUMMARY: "ALERT_DAY_SUMMARY",
  /** 무응답 2회·이상 징후·당일 위험 단계 상승에 따른 방문 큐 승격 */
  VISIT_PROMOTED: "VISIT_PROMOTED",
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export function isNotificationType(value: unknown): value is NotificationType {
  return (
    value === NotificationType.ALERT_DAY_SUMMARY ||
    value === NotificationType.VISIT_PROMOTED
  );
}

/** 방문 큐 승격 원인 — 알림 문구가 상태 전이와 다른 말을 하지 않게 하는 단일 원본 */
export const NotificationCause = {
  NO_ANSWER_2: "NO_ANSWER_2",
  SYMPTOM: "SYMPTOM",
  RISK_RECLASSIFIED: "RISK_RECLASSIFIED",
} as const;
export type NotificationCause =
  (typeof NotificationCause)[keyof typeof NotificationCause];

export function isNotificationCause(value: unknown): value is NotificationCause {
  return (
    value === NotificationCause.NO_ANSWER_2 ||
    value === NotificationCause.SYMPTOM ||
    value === NotificationCause.RISK_RECLASSIFIED
  );
}

export const NOTIFICATION_CAUSE_LABEL: Record<NotificationCause, string> = {
  NO_ANSWER_2: "무응답 2회로",
  SYMPTOM: "이상 징후로",
  RISK_RECLASSIFIED: "위험 단계 상승으로",
};

/** 가구별·경보일별 상태머신 (PRD F4·F5, docs/architecture.md §4) */
export const HouseholdStatus = {
  /** 미확인 */
  UNCHECKED: "UNCHECKED",
  /** 전화 확인 완료(정상) */
  CALL_OK: "CALL_OK",
  /** 무응답 1회 — 30분 후 재전화 */
  NO_ANSWER_1: "NO_ANSWER_1",
  /** 방문 큐 승격 (무응답 2회 / 이상 징후 / 심각 단계 즉시) */
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

/**
 * 이 상태에서 담당자가 남길 기록 종류.
 * 심각·승격 가구는 방문, 미확인·무응답 1회는 전화, 끝난 가구는 null (PRD F3·F4).
 */
export function nextCheckKindOf(status: HouseholdStatus): CheckKind | null {
  if (!isOpenHouseholdStatus(status)) return null;
  return status === HouseholdStatus.VISIT_QUEUED ||
    status === HouseholdStatus.VISITING
    ? CheckKind.VISIT
    : CheckKind.CALL;
}

/** 확인 기록 종류 라벨 — 기록 탭 목록에 그대로 쓴다. UI에서 다시 쓰지 않는다 */
export const CHECK_KIND_LABEL: Record<CheckKind, string> = {
  CALL: "전화",
  VISIT: "방문",
};

/** 전화 결과 원터치 기록 (PRD F4) */
export const CallResult = {
  OK: "OK",
  NO_ANSWER: "NO_ANSWER",
  /** 이상 징후 → 즉시 방문 큐 승격 */
  SYMPTOM: "SYMPTOM",
  /** 통화 중 119를 부른 경우 → 방문의 119와 같은 상태로 간다 (Figma ⑤ 30:2763) */
  EMERGENCY_119: "EMERGENCY_119",
  UNREACHABLE: "UNREACHABLE",
} as const;
export type CallResult = (typeof CallResult)[keyof typeof CallResult];

/**
 * 원터치 기록 버튼에 그대로 쓰는 라벨 — UI에서 문자열을 다시 쓰지 않는다.
 *
 * 문구는 Figma ⑤ 7:2345(통화 결과 시트)를 따른다. 담당자가 방금 한 통화를 떠올려
 * 고르는 자리라 상태 이름(`정상`·`무응답`)보다 겪은 일을 그대로 말하는 쪽이 빠르다
 * (60대 사용자 기준, PRD §9). 저장되는 값(`OK`·`NO_ANSWER`…)은 그대로라 DB·API는 바뀌지 않는다.
 *
 * `연락두절`은 Figma 시트에 버튼이 없다 — 상세 화면(RecordGrid)에서만 고를 수 있다.
 */
export const CALL_RESULT_LABEL: Record<CallResult, string> = {
  OK: "괜찮았어요",
  NO_ANSWER: "안 받으셨어요",
  SYMPTOM: "걱정돼요",
  EMERGENCY_119: "119 신고",
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

/**
 * 방문 전에 담당자가 현장에서 확인할 항목 — 방문 화면이 그대로 표시한다 (Figma 25:347).
 *
 * 결과값과 달리 체크리스트는 저장하지 않는다. 담당자가 방문 중 놓치기 쉬운 폭염 위험을
 * 같은 순서로 읽게 하는 안내다. 한파 모드를 넣을 때는 경보 종류별 상수로 분리해야 한다.
 */
export const VISIT_CHECKLIST: readonly string[] = [
  "집 안이 더운지 확인해 주세요",
  "얼굴 홍조나 어눌한 말이 보이면 119를 불러요",
  "선풍기나 에어컨이 작동하는지 확인해 주세요",
];

export function isVisitResult(value: unknown): value is VisitResult {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(VISIT_RESULT_LABEL, value)
  );
}
