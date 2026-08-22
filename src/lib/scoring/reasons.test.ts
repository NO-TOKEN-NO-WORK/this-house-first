import { describe, expect, it } from "vitest";
import { AlertLevel } from "../domain";
import { labelReasons, ReasonCategory } from "./reasons";
import { assessRisk } from "./score";

describe("labelReasons", () => {
  it("개인 → 건물 → 기상 순서로 분류한다", () => {
    expect(
      labelReasons(["1938년생 (88세)·독거", "1972년 단독주택 슬레이트", "오늘 심각 단계 (체감 38도)"]),
    ).toEqual([
      { category: ReasonCategory.PERSONAL, text: "1938년생 (88세)·독거" },
      { category: ReasonCategory.BUILDING, text: "1972년 단독주택 슬레이트" },
      { category: ReasonCategory.WEATHER, text: "오늘 심각 단계 (체감 38도)" },
    ]);
  });

  it("건물 사유가 없으면 개인·기상 두 줄로 분류한다", () => {
    expect(labelReasons(["1950년생 (76세)", "오늘 경계 단계"])).toEqual([
      { category: ReasonCategory.PERSONAL, text: "1950년생 (76세)" },
      { category: ReasonCategory.WEATHER, text: "오늘 경계 단계" },
    ]);
  });

  it("문장을 다시 쓰지 않는다 — 엔진이 준 문자열을 그대로 싣는다", () => {
    const reasons = ["1938년생 (88세)·독거·에어컨 없음/고장", "오늘 주의 단계"];
    expect(labelReasons(reasons).map((r) => r.text)).toEqual(reasons);
  });

  it("깨진 저장값(1건 이하)은 추측하지 않고 분류를 비운다", () => {
    expect(labelReasons(["위험 사유를 불러오지 못했습니다"])).toEqual([
      { category: null, text: "위험 사유를 불러오지 못했습니다" },
    ]);
    expect(labelReasons([])).toEqual([]);
  });

  it("스코어링 엔진의 실제 출력과 짝이 맞는다", () => {
    const { reasons } = assessRisk({
      subject: { birthYear: 1938, livesAlone: true },
      building: { isDetached: true, builtYear: 1972, structure: "슬레이트" },
      level: AlertLevel.EMERGENCY,
      feelsLikeMax: 38,
      year: 2026,
    });
    const labeled = labelReasons(reasons);

    expect(labeled.map((r) => r.category)).toEqual([
      ReasonCategory.PERSONAL,
      ReasonCategory.BUILDING,
      ReasonCategory.WEATHER,
    ]);
    // 분류가 맞는지는 엔진이 만든 문장 자체로 확인한다
    expect(labeled[0]?.text).toContain("1938년생");
    expect(labeled[1]?.text).toContain("1972년");
    expect(labeled[2]?.text).toContain("체감 38도");
  });

  it("건물 정보가 전혀 없는 대상자도 엔진 출력과 짝이 맞는다", () => {
    const { reasons } = assessRisk({
      subject: { birthYear: 1955, livesAlone: false },
      building: { isDetached: false },
      level: AlertLevel.ADVISORY,
      year: 2026,
    });
    expect(labelReasons(reasons).map((r) => r.category)).toEqual([
      ReasonCategory.PERSONAL,
      ReasonCategory.WEATHER,
    ]);
  });
});
