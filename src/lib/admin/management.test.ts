import { describe, expect, it } from "vitest";

describe("관리자 대상자·생활지원사 입력", () => {
  it("대상자 폼을 기존 Prisma 필드로만 정규화한다", async () => {
    const { parseSubjectForm } = await import("./management");
    const form = new FormData();
    form.set("name", "김○○");
    form.set("birthYear", "1938");
    form.set("phone", "010-0000-0101");
    form.set("livesAlone", "true");
    form.set("hasMobilityIssue", "true");
    form.set("hasChronicDisease", "unknown");
    form.set("airconStatus", "issue");
    form.set("workerId", "worker-1");
    form.set("buildingId", "building-1");

    expect(parseSubjectForm(form, 2026)).toEqual({
      name: "김○○",
      birthYear: 1938,
      phone: "010-0000-0101",
      livesAlone: true,
      hasMobilityIssue: true,
      hasChronicDisease: null,
      hasAircon: false,
      airconBroken: true,
      workerId: "worker-1",
      buildingId: "building-1",
    });
  });

  it("필수값과 연락처 형식을 서버에서 거부한다", async () => {
    const { parseSubjectForm } = await import("./management");
    const form = new FormData();
    form.set("name", "");
    form.set("birthYear", "2030");
    form.set("phone", "not-a-phone");

    expect(() => parseSubjectForm(form, 2026)).toThrow("대상자 이름");
  });

  it("생활지원사 이름과 연락처를 정규화한다", async () => {
    const { parseWorkerForm } = await import("./management");
    const form = new FormData();
    form.set("name", "박○○");
    form.set("phone", "010-0000-0201");

    expect(parseWorkerForm(form)).toEqual({
      name: "박○○",
      phone: "010-0000-0201",
    });
  });
});
