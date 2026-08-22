import { describe, expect, it } from "vitest";
import { HouseholdStatus } from "../../../../lib/domain";
import { normalizeWorkerDetailSearchParams } from "./page";

describe("생활지원사 상세 라우트", () => {
  it("날짜·검색어·상태 필터를 안전한 단일 값으로 제한한다", () => {
    expect(normalizeWorkerDetailSearchParams({
      date: "2026-08-22",
      subjectQuery: "김○○",
      status: HouseholdStatus.VISIT_QUEUED,
    })).toEqual({
      date: "2026-08-22",
      subjectQuery: "김○○",
      selectedStatus: HouseholdStatus.VISIT_QUEUED,
    });
    expect(normalizeWorkerDetailSearchParams({
      date: ["2026-08-22", "2026-08-23"],
    })).toBeNull();
    expect(normalizeWorkerDetailSearchParams({ status: "BROKEN" })).toBeNull();
  });
});
