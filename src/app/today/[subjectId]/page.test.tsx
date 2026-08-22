import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SubjectDetailView } from "@/components/today/SubjectDetailView";
import type { SubjectDetail } from "@/lib/board/subject";

const { getSubjectDetail } = vi.hoisted(() => ({ getSubjectDetail: vi.fn() }));

vi.mock("@/lib/board/subject", () => ({ getSubjectDetail }));

import SubjectDetailPage from "./page";

const detail = { subjectId: "subject-1" } as SubjectDetail;

describe("SubjectDetailPage", () => {
  it("view=info는 읽기 전용 대상자 정보 화면으로 분기한다", async () => {
    getSubjectDetail.mockResolvedValue(detail);

    const page = await SubjectDetailPage({
      params: Promise.resolve({ subjectId: "subject-1" }),
      searchParams: Promise.resolve({
        date: "2026-08-22",
        workerId: "worker-1",
        grade: "2",
        view: "info",
      }),
    });

    expect(isValidElement(page)).toBe(true);
    if (!isValidElement(page)) return;
    expect(page.type).toBe(SubjectDetailView);
    expect(page.props).toMatchObject({
      detail,
      informationOnly: true,
      backHref: "/today?date=2026-08-22&workerId=worker-1&grade=2",
    });
  });

  it("view가 없으면 기존 기록 화면을 유지한다", async () => {
    getSubjectDetail.mockResolvedValue(detail);

    const page = await SubjectDetailPage({
      params: Promise.resolve({ subjectId: "subject-1" }),
      searchParams: Promise.resolve({ date: "2026-08-22" }),
    });

    expect(isValidElement(page)).toBe(true);
    if (!isValidElement(page)) return;
    expect(page.props).toMatchObject({ informationOnly: false });
  });
});
