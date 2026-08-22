import { describe, expect, it } from "vitest";
import { simulateWeightedExposure } from "./exposure";

describe("simulateWeightedExposure", () => {
  it("무작위 확인보다 위험점수 순 확인의 위험가중 미확인 노출을 줄인다", () => {
    const scores = [1, 3, 2];

    expect(simulateWeightedExposure(scores)).toEqual({
      randomExpected: 12,
      prioritized: 10,
      reductionRate: 1 / 6,
    });
    expect(scores).toEqual([1, 3, 2]);
  });

  it("대상자가 없으면 감소율을 0으로 반환한다", () => {
    expect(simulateWeightedExposure([])).toEqual({
      randomExpected: 0,
      prioritized: 0,
      reductionRate: 0,
    });
  });
});
