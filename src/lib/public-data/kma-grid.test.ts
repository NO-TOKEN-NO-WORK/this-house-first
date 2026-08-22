import { describe, expect, it } from "vitest";
import { toKmaGrid } from "./kma-grid";

describe("toKmaGrid", () => {
  it("서울시청 위경도를 기상청 공식 5km 격자로 변환한다", () => {
    expect(toKmaGrid(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 });
  });

  it.each([
    [Number.NaN, 126.978],
    [40.7128, -74.006],
  ])("유효하지 않거나 지원 지역 밖인 좌표 %s, %s를 거절한다", (lat, lng) => {
    expect(() => toKmaGrid(lat, lng)).toThrow(
      "기상청 동네예보 지원 지역이 아닙니다.",
    );
  });
});
