import { describe, expect, it } from "vitest";
import { AlertLevel } from "../domain";
import {
  calculateSummerFeelsLikeTemperature,
  classifyHeatAlert,
} from "./heat";

describe("calculateSummerFeelsLikeTemperature", () => {
  it("기온과 습도로 기상청 여름철 체감온도를 계산한다", () => {
    expect(calculateSummerFeelsLikeTemperature(33, 70)).toBe(34.3);
  });

  it("상대습도를 0~100 범위로 제한한다", () => {
    expect(calculateSummerFeelsLikeTemperature(30, 120)).toBe(
      calculateSummerFeelsLikeTemperature(30, 100),
    );
  });
});

describe("classifyHeatAlert", () => {
  it.each([
    [32.9, undefined, null],
    [33, undefined, AlertLevel.ADVISORY],
    [35, undefined, AlertLevel.WARNING],
    [38, undefined, AlertLevel.EMERGENCY],
    [35, 39, AlertLevel.EMERGENCY],
  ])("체감 %s℃, 기온 %s℃를 %s 단계로 판정한다", (feelsLike, air, expected) => {
    expect(classifyHeatAlert(feelsLike, air)).toBe(expected);
  });
});
