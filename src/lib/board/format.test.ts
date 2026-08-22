import { describe, expect, it } from "vitest";
import { ageOf, dongOf, formatBoardDate, yearOfIsoDate } from "./format";

describe("formatBoardDate", () => {
  it("경보일 날짜를 화면 표기로 바꾼다", () => {
    expect(formatBoardDate("2026-08-21")).toBe("8월 21일(금)");
    expect(formatBoardDate("2026-01-01")).toBe("1월 1일(목)");
    expect(formatBoardDate("2026-12-31")).toBe("12월 31일(목)");
  });

  it("KST 날짜 문자열을 시간대 때문에 하루 밀지 않는다", () => {
    // 실행 환경 시간대와 무관하게 같은 결과여야 한다
    expect(formatBoardDate("2026-08-01")).toBe("8월 1일(토)");
  });

  it("형식이 다르면 조용히 넘기지 않고 던진다", () => {
    expect(() => formatBoardDate("20260821")).toThrow();
    expect(() => formatBoardDate("")).toThrow();
  });
});

describe("yearOfIsoDate", () => {
  it("나이 계산 기준 연도를 뽑는다", () => {
    expect(yearOfIsoDate("2026-08-21")).toBe(2026);
  });
});

describe("ageOf", () => {
  it("스코어링 엔진과 같은 방식(연도 차)으로 나이를 낸다", () => {
    expect(ageOf(1938, 2026)).toBe(88);
    expect(ageOf(1961, 2026)).toBe(65);
  });
});

describe("dongOf", () => {
  it("지번 주소에서 행정동만 뽑는다", () => {
    expect(dongOf("대구광역시 서구 비산동 1234-5")).toBe("비산동");
    expect(dongOf("대구광역시 서구 비산동")).toBe("비산동");
  });

  it("읍·면도 담당 구역으로 인정한다", () => {
    expect(dongOf("세종특별자치시 조치원읍 123")).toBe("조치원읍");
    expect(dongOf("전라남도 해남군 송지면 45-1")).toBe("송지면");
  });

  it("동으로 끝나지 않는 시·군·구는 고르지 않는다", () => {
    expect(dongOf("경기도 안양시 동안구")).toBeNull();
    expect(dongOf("서울특별시 성동구")).toBeNull();
  });

  it("찾지 못하면 null — 화면에서 구역 표기를 통째로 생략한다", () => {
    expect(dongOf("")).toBeNull();
    expect(dongOf("주소 미상")).toBeNull();
  });
});
