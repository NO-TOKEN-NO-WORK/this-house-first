import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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
  gradeLabel: "심각",
  status: "VISIT_QUEUED",
  statusLabel: "방문 대기",
  reasons: ["1938년생·독거", "1972년 단독주택·슬레이트", "오늘 체감 38도"],
  date: "2026-08-22",
  workers: [{ id: "worker-1", name: "박○○", phone: "010-0000-0001", role: "WORKER" }],
  buildings: [],
  latestMemo: {
    text: "냉방기 필터 청소 권고",
    createdAt: "2026.08.22 10:05",
    workerName: "박○○",
  },
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
  it("공용 헤더에 현재 날씨를 표시하고 고정 갱신 시각을 쓰지 않는다", async () => {
    const { AdminManagementHeader } = await import("./AdminSubjectViews");
    const html = renderToStaticMarkup(
      <AdminManagementHeader detail={detail} label="대상자 상세" />,
    );

    expect(html).toContain('aria-label="현재 날씨"');
    expect(html).not.toContain("현재 위치 날씨");
    expect(html).not.toContain("14:32");
  });

  it("신규 관리 헤더의 날짜는 현재 KST 날짜를 쓴다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-01-01T15:00:00.000Z"));

    try {
      const { AdminManagementHeader } = await import("./AdminSubjectViews");
      const html = renderToStaticMarkup(
        <AdminManagementHeader detail={null} label="대상자 등록" />,
      );

      expect(html).toContain("2031.01.02");
      expect(html).not.toContain("2026.08.22");
    } finally {
      vi.useRealTimers();
    }
  });

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
    expect(html).toContain("위험 단계");
    expect(html).toContain(
      'aria-label="경보 단계"><span>주의</span><span>경계</span><strong>비상</strong>',
    );
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

  it("보관 시 현재 목록에서만 제외하고 과거 관제 이력은 유지한다고 안내한다", async () => {
    const { AdminSubjectDetailView } = await import("./AdminSubjectViews");
    const html = renderToStaticMarkup(
      <AdminSubjectDetailView archiveAction={async () => {}} detail={detail} />,
    );

    expect(html).toContain("대상자 보관");
    expect(html).toContain("과거 경보·점검 이력은 보존됩니다.");
    expect(html).not.toContain("대상자 삭제");
  });
});

describe("현장 메모", () => {
  it("위험 사유와 함께, 언제·누가 남겼는지까지 보여준다", async () => {
    const { AdminSubjectDetailView } = await import("./AdminSubjectViews");
    const html = renderToStaticMarkup(<AdminSubjectDetailView detail={detail} />);

    expect(html).toContain("현장 메모");
    expect(html).toContain("냉방기 필터 청소 권고");
    // 오래된 메모를 오늘 관찰로 읽지 않도록 시각·점검자를 함께 싣는다
    expect(html).toContain("2026.08.22 10:05 · 박○○");
  });

  it("가장 최근 기록에 메모가 없어도 남아 있는 메모를 지우지 않는다", async () => {
    // 상세 화면의 원터치 기록(RecordGrid)은 메모를 받지 않는다.
    // 그 기록이 맨 앞에 와도 관리자 화면에서 메모가 사라지면 안 된다.
    const withMemolessLatest = {
      ...detail,
      checks: [
        {
          id: "check-2",
          date: "2026-08-22",
          createdAt: "2026.08.22 14:20",
          workerName: "박○○",
          kind: "전화",
          result: "안 받으셨어요",
          memo: null,
        },
        ...detail.checks,
      ],
    } as unknown as AdminSubjectDetail;

    const { AdminSubjectDetailView } = await import("./AdminSubjectViews");
    const html = renderToStaticMarkup(
      <AdminSubjectDetailView detail={withMemolessLatest} />,
    );

    // 현장 메모 칸만 집어서 본다 — "미등록"은 다른 항목도 쓰는 문구다
    const memoCell = /<dt>현장 메모<\/dt><dd>([^<]*)<\/dd>/.exec(html)?.[1];
    expect(memoCell).toContain("냉방기 필터 청소 권고");
  });
});
