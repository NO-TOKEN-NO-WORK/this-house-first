import { HouseholdStatus, RiskGrade } from "../domain";

/**
 * 경보일 발령 시점의 가구 상태 결정 — 순수 함수 (docs/architecture.md §4 상태머신의 진입부).
 *
 * 전화→방문 전이(FR-5)는 `transition.ts`(예정)가 담당하고, 이 파일은 "경보일 아침 생성"
 * 화살표만 책임진다.
 */

/**
 * 새 가구의 초기 상태.
 * 심각 단계는 전화를 생략하고 곧바로 방문 대상이다 — 전화로 '괜찮다'를 신뢰할 수 없는 군이기
 * 때문 (PRD F3, 질병청 "고령자는 초기 증상 자기 인지 어려움").
 */
export function initialHouseholdStatus(grade: RiskGrade): HouseholdStatus {
  return grade === RiskGrade.CRITICAL
    ? HouseholdStatus.VISIT_QUEUED
    : HouseholdStatus.UNCHECKED;
}

/**
 * 발령 시 적용할 상태를 정한다. `null`이면 "변경하지 않는다"는 뜻이다.
 *
 * 같은 날 재발령은 데모(ADR-0011 수동 시뮬레이션)와 단계 상승(주의→심각) 때 실제로 일어난다.
 * 이때 이미 진행된 기록(전화 완료·방문 중·119 연계 등)을 초기화하면 그날의 확인 이력이
 * 사라지므로, **미확인 상태만** 승격 대상으로 삼고 나머지는 그대로 둔다.
 *
 * @param current 기존 상태. 해당 경보일에 아직 행이 없으면 null
 */
export function resolveStatusOnDeclare(
  current: HouseholdStatus | null,
  grade: RiskGrade,
): HouseholdStatus | null {
  if (current === null) return initialHouseholdStatus(grade);

  // 재발령으로 심각 단계가 된 미확인 가구는 방문 큐로 승격한다
  if (current === HouseholdStatus.UNCHECKED && grade === RiskGrade.CRITICAL) {
    return HouseholdStatus.VISIT_QUEUED;
  }

  return null; // 진행 중인 기록 보존
}
