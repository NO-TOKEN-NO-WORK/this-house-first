/**
 * 위험 사유의 분류 — 순수 함수 (FR-3 설명 가능성).
 *
 * 대상자 상세 화면(Figma ② 3:531)은 사유를 "개인 / 건물 / 기상" 세 줄로 나눠 보여준다.
 * 그렇다고 UI가 사유 문장을 다시 쓰면 안 된다 (AGENTS.md 도메인 규칙 3) — 그래서 이 파일은
 * **문장은 건드리지 않고 어느 축의 사유인지만 붙인다**.
 *
 * 분류 근거는 `score.ts`의 push 순서다(엔진의 계약):
 *   1) 개인 사유 1건 — 항상 넣는다
 *   2) 건물 사유 0~1건 — 건축 연도·구조 정보가 하나도 없으면 생략된다
 *   3) 기상 사유 1건 — 항상 넣는다
 * `score.ts`가 사유를 추가·재배치하면 이 파일과 `reasons.test.ts`를 함께 고쳐야 한다.
 */

export const ReasonCategory = {
  PERSONAL: "PERSONAL",
  BUILDING: "BUILDING",
  WEATHER: "WEATHER",
} as const;
export type ReasonCategory =
  (typeof ReasonCategory)[keyof typeof ReasonCategory];

export const REASON_CATEGORY_LABEL: Record<ReasonCategory, string> = {
  PERSONAL: "개인",
  BUILDING: "건물",
  WEATHER: "기상",
};

export interface LabeledReason {
  /** 분류를 확신할 수 없으면 null — 아이콘 없이 문장만 보여준다 */
  category: ReasonCategory | null;
  /** 스코어링 엔진이 만든 문장 그대로 */
  text: string;
}

/**
 * 저장된 사유 배열(JSON string[])에 분류를 붙인다.
 *
 * 엔진은 개인·기상 사유를 항상 넣으므로 정상 결과는 길이 2 또는 3이다. 그보다 짧으면
 * 저장값이 깨진 것이므로 추측해서 잘못된 아이콘을 붙이는 대신 분류를 비워 둔다.
 */
export function labelReasons(reasons: readonly string[]): LabeledReason[] {
  if (reasons.length < 2) {
    return reasons.map((text) => ({ category: null, text }));
  }
  return reasons.map((text, index) => ({
    category:
      index === 0
        ? ReasonCategory.PERSONAL
        : index === reasons.length - 1
          ? ReasonCategory.WEATHER
          : ReasonCategory.BUILDING,
    text,
  }));
}
