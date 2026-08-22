import { RiskGrade } from "@/lib/domain";

/**
 * 등급 칩 색 — 보드 섹션 헤더·대상자 상세 배지·전화 안내 다이얼로그가 같은 표를 쓴다.
 * 화면마다 표를 따로 들면 같은 등급이 화면마다 다른 색으로 보인다 (ADR-0015가 막으려는 것).
 *
 * 배경은 Figma 그대로다. 글자색은 2·3등급만 Figma의 흰색 대신 `text-primary`를 쓴다 —
 * 흰색은 각 2.25:1·2.54:1이라 읽히지 않는다(→ 6.92:1·6.14:1). ADR-0014의 접근성 예외.
 */
export const GRADE_CHIP: Record<RiskGrade, string> = {
  [RiskGrade.CRITICAL]: "bg-status-critical text-text-inverse",
  [RiskGrade.HIGH]: "bg-status-warning text-text-primary",
  [RiskGrade.MODERATE]: "bg-status-neutral text-text-primary",
};
