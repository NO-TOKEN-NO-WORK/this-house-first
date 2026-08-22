import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AlertLevel, HouseholdStatus, RiskGrade } from "../../lib/domain";
import type { AdminWorkerDetail } from "../../lib/admin/worker-detail";
import { AdminWorkerDetailView } from "./AdminWorkerDetailView";

const detail = {
  id: "worker-1",
  name: "박○○",
  phone: "010-1234-5678",
  date: "2026-08-22",
  region: "봉화군 춘양면",
  organization: "춘양면 행정복지센터",
  feelsLikeMax: 38.4,
  alertLevel: AlertLevel.EMERGENCY,
  workStatus: "근무 중",
  lastStateChangedAt: "14:10",
  summary: {
    openCritical: 1,
    visitQueued: 1,
    completed: 1,
    coolingNeeded: 1,
  },
  subjects: [{
    id: "subject-1",
    name: "김○○",
    phone: "010-0000-0101",
    birthYear: 1938,
    age: 88,
    livesAlone: true,
    hasAircon: false,
    airconBroken: false,
    building: {
      id: "building-1",
      address: "경상북도 봉화군 춘양면 도심리 7",
      roadAddress: null,
      lat: 36.9,
      lng: 128.9,
      builtYear: 1972,
      isDetached: true,
      structure: "슬레이트",
    },
    address: "경상북도 봉화군 춘양면 도심리 7",
    grade: RiskGrade.CRITICAL,
    score: 32,
    reasons: ["1938년생·독거", "오늘 체감 38도"],
    status: HouseholdStatus.VISIT_QUEUED,
    statusLabel: "방문 대기",
    open: true,
  }],
  activities: [{
    id: "check-1",
    subjectId: "subject-1",
    subjectName: "김○○",
    label: "방문 조치함",
    memo: null,
    date: "2026-08-22",
    time: "14:10",
  }],
} satisfies AdminWorkerDetail;

describe("관리자 생활지원사 상세 화면", () => {
  it("참고 화면의 업무 요약과 담당 대상자 동선을 실제 링크로 제공한다", () => {
    const html = renderToStaticMarkup(
      <AdminWorkerDetailView detail={detail} />,
    );

    expect(html).toContain("생활지원사 상세");
    expect(html).toContain("관리자 관제");
    expect(html).toContain("집중 확인 필요");
    expect(html).toContain("오늘 담당 현황");
    expect(html).toContain("담당 대상자 목록");
    expect(html).toContain("담당 지역");
    expect(html).toContain("최근 활동");
    expect(html).toContain("1938년생·독거 / 오늘 체감 38도");
    expect(html).toContain('href="tel:010-1234-5678"');
    expect(html).toContain('href="/admin/workers/worker-1/edit"');
    expect(html).toContain('href="/admin/subjects/subject-1?date=2026-08-22"');
    expect(html).toContain('href="/admin?date=2026-08-22"');
    expect(html).toContain('href="/today/log?workerId=worker-1&amp;date=2026-08-22"');
    expect(html).toContain('aria-label="대상자 검색"');
    expect(html).toContain('aria-label="대상자 상태"');
    expect(html).not.toContain("응급 연락 우선 대응");
  });

  it("검색 결과가 비면 빈 상태를 명확히 안내한다", () => {
    const html = renderToStaticMarkup(
      <AdminWorkerDetailView detail={detail} subjectQuery="없는 이름" />,
    );

    expect(html).toContain("조건에 맞는 담당 대상자가 없습니다.");
    expect(html).not.toContain("1938년생·독거 / 오늘 체감 38도");
  });

  it("전화번호가 없으면 전화 빠른 실행을 비활성 상태로 표시한다", () => {
    const html = renderToStaticMarkup(
      <AdminWorkerDetailView detail={{ ...detail, phone: null }} />,
    );

    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('href="tel:');
  });
});
