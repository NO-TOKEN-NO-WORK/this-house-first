import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AdminSubjectDetail } from "../../lib/admin/subject-detail";

const detail = {
  id: "subject-1",
  name: "김○○",
  birthYear: 1938,
  age: 88,
  phone: "010-0000-0101",
  livesAlone: true,
  hasMobilityIssue: true,
  hasChronicDisease: null,
  hasAircon: false,
  airconBroken: true,
  workerId: "worker-1",
  workerName: "박○○",
  workerPhone: "010-0000-0001",
  buildingId: "building-1",
  building: {
    id: "building-1",
    address: "봉화군 춘양면 도심1길 7",
    roadAddress: "봉화군 춘양면 도심1길 7",
    lat: 36.9,
    lng: 128.9,
    builtYear: 1972,
    isDetached: true,
    structure: "슬레이트",
    roof: "슬레이트",
  },
  address: "봉화군 춘양면 도심1길 7",
  grade: 1,
  gradeLabel: "1등급",
  status: "VISIT_QUEUED",
  statusLabel: "방문 대기",
  reasons: ["1938년생·독거", "1972년 단독주택·슬레이트", "오늘 체감 38도"],
  date: "2026-08-22",
  workers: [{ id: "worker-1", name: "박○○", phone: "010-0000-0001", role: "WORKER" }],
  buildings: [],
  checks: [
    {
      id: "check-1",
      date: "2026-08-22",
      createdAt: "2026.08.22 10:05",
      workerName: "박○○",
      kind: "방문",
      result: "에어컨 없음·고장",
      memo: "냉방기 필터 청소 권고",
    },
  ],
} as unknown as AdminSubjectDetail;

describe("관리자 대상자 상세·수정 화면", () => {
  it("첨부 시안의 상세 정보 구획과 실제 위험 사유를 모두 보여준다", async () => {
    const { AdminSubjectDetailView } = await import("./AdminSubjectViews");
    const html = renderToStaticMarkup(<AdminSubjectDetailView detail={detail} />);

    for (const text of [
      "대상자 상세",
      "기본 정보",
      "위험 정보",
      "설비 점검 현황",
      "담당 생활지원사",
      "위치 정보",
      "점검 이력",
      "1938년생·독거",
    ]) expect(html).toContain(text);
    expect(html).toContain("1938년 (88세)");
    expect(html).not.toContain("미등록-미등록");
    expect(html).toContain('href="/admin/subjects/subject-1/edit"');
  });

  it("수정 화면은 시안과 같은 세 구획과 저장 동작을 제공한다", async () => {
    const { AdminSubjectFormView } = await import("./AdminSubjectViews");
    const html = renderToStaticMarkup(
      <AdminSubjectFormView action={async () => {}} detail={detail} mode="edit" />,
    );

    expect(html).toContain("대상자 수정");
    expect(html).toContain("① 기본 정보");
    expect(html).toContain("② 위험/관제 정보");
    expect(html).toContain("③ 설비 점검 정보");
    expect(html).toContain("저장");
  });
});
