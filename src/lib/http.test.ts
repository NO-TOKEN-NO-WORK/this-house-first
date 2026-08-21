import { describe, expect, it } from "vitest";
import { ApiError, optionalId, optionalIsoDate } from "./http";

describe("optionalIsoDate", () => {
  it("실제 달력에 존재하는 날짜만 허용한다", () => {
    expect(optionalIsoDate("2024-02-29")).toBe("2024-02-29");
    expect(() => optionalIsoDate("2026-02-29")).toThrow(ApiError);
    expect(() => optionalIsoDate("2026-04-31")).toThrow(ApiError);
  });

  it("YYYY-MM-DD 형식이 아니면 거절한다", () => {
    expect(() => optionalIsoDate("20260822")).toThrow(ApiError);
  });
});

describe("optionalId", () => {
  it("앞뒤 공백을 제거한 ID를 반환한다", () => {
    expect(optionalId("  subject-id  ", "subjectId")).toBe("subject-id");
  });

  it("공백뿐인 값과 64자를 넘는 ID를 거절한다", () => {
    expect(() => optionalId("   ", "subjectId")).toThrow(ApiError);
    expect(() => optionalId("a".repeat(65), "subjectId")).toThrow(ApiError);
  });
});
