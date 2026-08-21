import { describe, expect, it } from "vitest";
import {
  AlertLevel,
  HouseholdStatus,
  isAlertLevel,
  isHouseholdStatus,
  parseHouseholdStatus,
} from "./domain";

describe("도메인 상태값 검증", () => {
  it("정의된 경보 단계와 가구 상태만 허용한다", () => {
    expect(isAlertLevel(AlertLevel.ADVISORY)).toBe(true);
    expect(isHouseholdStatus(HouseholdStatus.UNCHECKED)).toBe(true);
  });

  it("Object 프로토타입의 속성은 상태값으로 허용하지 않는다", () => {
    expect(isAlertLevel("toString")).toBe(false);
    expect(isAlertLevel("__proto__")).toBe(false);
    expect(isHouseholdStatus("toString")).toBe(false);
    expect(isHouseholdStatus("constructor")).toBe(false);
    expect(() => parseHouseholdStatus("toString")).toThrow(
      "알 수 없는 가구 상태값",
    );
  });
});
