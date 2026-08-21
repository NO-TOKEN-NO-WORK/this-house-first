import { describe, expect, it } from "vitest";
import { toIsoDate, yearOfCompactDate } from "./alert-date";

describe("toIsoDate", () => {
  it("기상청 YYYYMMDD를 AlertDay.date 표기로 바꾼다", () => {
    expect(toIsoDate("20260823")).toBe("2026-08-23");
    expect(toIsoDate("20260101")).toBe("2026-01-01");
  });

  it("형식·범위가 틀리면 던진다 — 같은 날짜로 경보일이 두 개 생기는 사고 방지", () => {
    expect(() => toIsoDate("2026-08-23")).toThrow();
    expect(() => toIsoDate("2026823")).toThrow();
    expect(() => toIsoDate("20261323")).toThrow();
    expect(() => toIsoDate("20260800")).toThrow();
  });
});

describe("yearOfCompactDate", () => {
  it("나이 계산 기준 연도를 뽑는다", () => {
    expect(yearOfCompactDate("20260823")).toBe(2026);
  });
});
