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

/**
 * 같은 표의 옅은 변형 — 카드 안 등급 배지처럼 색 면적이 넓어 진한 배경이 부담스러운 자리.
 * 여기 두는 이유는 위와 같다: 화면마다 표를 따로 들면 같은 등급이 화면마다 다른 색으로 보인다.
 *
 * 배경은 Figma 그대로다(38:5687 심각 · 123:3167 경계). 경계 글자만 Figma의
 * `status/warning`(#f29900) 대신 `status-warning-strong`을 쓴다 — amber-50 위 amber-500은
 * 1.94:1이라 12px 글자가 읽히지 않는다(→ 5.32:1). ADR-0014의 접근성 예외.
 */
export const GRADE_CHIP_SUBTLE: Record<RiskGrade, string> = {
  [RiskGrade.CRITICAL]: "bg-status-critical-subtle text-status-critical-strong",
  [RiskGrade.HIGH]: "bg-status-warning-subtle text-status-warning-strong",
  [RiskGrade.MODERATE]: "bg-background-subtle text-text-supporting",
};
