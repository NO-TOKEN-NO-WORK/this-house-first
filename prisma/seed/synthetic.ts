import { WorkerRole } from "../../src/lib/domain";

/**
 * 합성 인물 — "건물은 진짜, 사람은 가짜" (PRD §8).
 * 아래 이름·생년·연락처는 모두 가상이며 실존 인물과 무관하다. 실명·실인물 데이터 절대 금지 (AGENTS.md).
 *
 * 프로필은 난수가 아니라 고정 설계다: 위험점수 스펙트럼(1·2·3등급)이 고르게 나오도록
 * 연령대 × 독거 × 건강 × 건물 슬롯을 조합했다. 등급 컷오프 캘리브레이션(ADR-0005)의 기준 데이터.
 * buildingSlot은 config.ts BUILDING_SLOTS의 인덱스다.
 */

export interface SyntheticSubject {
  name: string;
  birthYear: number;
  phone: string;
  livesAlone: boolean;
  hasMobilityIssue: boolean | null;
  hasChronicDisease: boolean | null;
  /** null = 미확인. false → 지원사업 연계 플래그 (FR-11) */
  hasAircon: boolean | null;
  buildingSlot: number;
}

export interface SyntheticWorker {
  name: string;
  phone: string;
  role: WorkerRole;
}

/** 담당자 1명(생활지원사) + 관리자 1명 — 모두 가상 인물 */
export const WORKERS: readonly SyntheticWorker[] = [
  { name: "이미경", phone: "010-0000-0001", role: WorkerRole.WORKER },
  { name: "박준호", phone: "010-0000-0002", role: WorkerRole.MANAGER },
];

/** 담당자 1인당 15명 (복지부 지침, PRD P3) */
export const SUBJECTS: readonly SyntheticSubject[] = [
  // ── 1980년 이전 단독주택 (슬롯 0~4): 80+ 독거가 몰린 가장 위험한 군
  { name: "김순자", birthYear: 1938, phone: "010-0000-0101", livesAlone: true,  hasMobilityIssue: null,  hasChronicDisease: null,  hasAircon: false, buildingSlot: 0 },
  { name: "박영희", birthYear: 1940, phone: "010-0000-0102", livesAlone: true,  hasMobilityIssue: true,  hasChronicDisease: null,  hasAircon: null,  buildingSlot: 1 },
  { name: "이정순", birthYear: 1945, phone: "010-0000-0103", livesAlone: false, hasMobilityIssue: null,  hasChronicDisease: null,  hasAircon: true,  buildingSlot: 2 },
  { name: "최말순", birthYear: 1949, phone: "010-0000-0104", livesAlone: true,  hasMobilityIssue: null,  hasChronicDisease: true,  hasAircon: null,  buildingSlot: 3 },
  { name: "정옥분", birthYear: 1950, phone: "010-0000-0105", livesAlone: true,  hasMobilityIssue: null,  hasChronicDisease: null,  hasAircon: true,  buildingSlot: 4 },
  { name: "강복남", birthYear: 1955, phone: "010-0000-0106", livesAlone: true,  hasMobilityIssue: false, hasChronicDisease: false, hasAircon: null,  buildingSlot: 0 }, // 슬롯 0 동일 건물(다가구 상정)
  // ── 1980~99년 단독주택 (슬롯 5~6)
  { name: "조영자", birthYear: 1944, phone: "010-0000-0107", livesAlone: true,  hasMobilityIssue: null,  hasChronicDisease: null,  hasAircon: null,  buildingSlot: 5 },
  { name: "윤분이", birthYear: 1958, phone: "010-0000-0108", livesAlone: false, hasMobilityIssue: null,  hasChronicDisease: null,  hasAircon: true,  buildingSlot: 6 },
  // ── 2000년 이후 단독주택 (슬롯 7)
  { name: "장갑순", birthYear: 1952, phone: "010-0000-0109", livesAlone: true,  hasMobilityIssue: null,  hasChronicDisease: null,  hasAircon: true,  buildingSlot: 7 },
  { name: "임춘식", birthYear: 1960, phone: "010-0000-0110", livesAlone: false, hasMobilityIssue: null,  hasChronicDisease: null,  hasAircon: true,  buildingSlot: 7 },
  // ── 공동주택 A (슬롯 8)
  { name: "한병철", birthYear: 1947, phone: "010-0000-0111", livesAlone: true,  hasMobilityIssue: null,  hasChronicDisease: null,  hasAircon: true,  buildingSlot: 8 },
  { name: "오금례", birthYear: 1957, phone: "010-0000-0112", livesAlone: false, hasMobilityIssue: null,  hasChronicDisease: true,  hasAircon: true,  buildingSlot: 8 },
  { name: "서정길", birthYear: 1953, phone: "010-0000-0113", livesAlone: false, hasMobilityIssue: null,  hasChronicDisease: null,  hasAircon: null,  buildingSlot: 8 },
  // ── 공동주택 B, 최상층 (슬롯 9)
  { name: "신옥희", birthYear: 1943, phone: "010-0000-0114", livesAlone: true,  hasMobilityIssue: null,  hasChronicDisease: null,  hasAircon: false, buildingSlot: 9 },
  { name: "권태식", birthYear: 1961, phone: "010-0000-0115", livesAlone: true,  hasMobilityIssue: null,  hasChronicDisease: null,  hasAircon: true,  buildingSlot: 9 },
];

/** 슬롯 9(공동주택 B)의 가구는 최상층 — 건축물대장에 없는 가구 속성이라 시드가 합성 (weights.ts TOP_FLOOR) */
export const TOP_FLOOR_SLOTS: ReadonlySet<number> = new Set([9]);
