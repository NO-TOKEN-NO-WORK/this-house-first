import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AlertLevel,
  HouseholdStatus,
  HOUSEHOLD_STATUS_LABEL,
} from "../../lib/domain";

const mocks = vi.hoisted(() => ({
  getAdminDashboard: vi.fn(),
  getManagerNotificationFeed: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("../../lib/admin/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/admin/dashboard")>()),
  getAdminDashboard: mocks.getAdminDashboard,
}));
vi.mock("../../lib/notifications/read", () => ({
  getManagerNotificationFeed: mocks.getManagerNotificationFeed,
}));

import AdminPage, {
  AdminDashboardView,
  NotificationFeed,
  PriorityList,
  SummaryCards,
} from "./page";
import { WelfareScanWorkspace } from "../../components/admin/WelfareScanWorkspace";

const adminStyles = readFileSync(
  new URL("./admin.module.css", import.meta.url),
  "utf8",
);
const adminShellStyles = readFileSync(
  new URL("../../components/admin/admin-shell.module.css", import.meta.url),
  "utf8",
);

describe("관리자 관제 화면", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getManagerNotificationFeed.mockResolvedValue({
      recipientId: "manager-1",
      items: [],
    });
  });

  it("승격 사건을 관리자 인앱 피드와 상세 딥링크로 표시한다", () => {
    const html = renderToStaticMarkup(
      <NotificationFeed
        feed={{
          recipientId: "manager-1",
          items: [
            {
              id: "notification-1",
              title: "방문 확인 대상이 추가됐습니다",
              body: "박○○ 대상자가 무응답 2회로 방문 대기 상태가 됐습니다.",
              href: "/today/subject-1?date=2026-08-22&workerId=worker-1",
              availableAt: "2026-08-22T01:00:00.000Z",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("방문 승격 알림");
    expect(html).toContain("박○○ 대상자");
    expect(html).toContain("/today/subject-1?date=2026-08-22&amp;workerId=worker-1");
  });

  it("공통 브랜드 링크를 한 줄로 유지하고 완료한 viewport QA를 표기한다", () => {
    expect(adminShellStyles).toMatch(/\.brand\s*\{[^}]*white-space:\s*nowrap;/);
    expect(adminStyles).toContain("responsive: pass (49)");
    expect(adminStyles).toContain("mobile: pass (34, 49, 50–57)");
    expect(adminStyles).toContain(
      "Committed tone: utilitarian · palette anchor hue: cobalt",
    );
    expect(adminStyles).not.toContain(
      "@media (prefers-reduced-motion: no-preference)",
    );
  });

  it("위험도 우선 대상자 행은 읽기 쉬운 간격을 유지한다", () => {
    expect(adminStyles).toMatch(
      /\.priorityTable td\s*\{[^}]*block-size:\s*3\.25rem;[^}]*padding-block:\s*0\.5rem;[^}]*padding-inline:\s*0\.75rem;/,
    );
    expect(adminStyles).toMatch(
      /\.priorityTable th\s*\{[^}]*padding-inline:\s*0\.75rem;/,
    );
    expect(adminStyles).toMatch(
      /\.priorityTable \.rowActions\s*\{[^}]*gap:\s*0\.5rem;/,
    );
  });

  it("건물과 위험도 목록은 패널 안에서 세로로 스크롤된다", () => {
    expect(adminStyles).toMatch(
      /\.buildingPanel,\s*\.priorityPanel\s*\{[^}]*display:\s*flex;[^}]*max-block-size:\s*20\.5rem;[^}]*flex-direction:\s*column;/,
    );
    expect(adminStyles).toMatch(
      /\.buildingList,\s*\.priorityPanel \.tableScroller\s*\{[^}]*min-block-size:\s*0;[^}]*overflow-y:\s*auto;/,
    );
  });

  it("지도는 선택 대상자 정보를 내부 스크롤 없이 보여줄 높이를 확보한다", () => {
    expect(adminStyles).toMatch(
      /\.dashboardContent\s*\{[^}]*grid-template-rows:\s*auto 6\.5rem 24rem 20\.5rem;/,
    );
  });

  it("반복된 날짜나 담당자 검색값은 조회 전에 404로 막는다", async () => {
    const repeatedSearches = [
      { date: ["2026-08-22", "2026-08-23"] },
      { workerId: ["worker-1", "worker-2"] },
    ];

    for (const searchParams of repeatedSearches) {
      await expect(
        AdminPage({
          params: Promise.resolve({}),
          searchParams: Promise.resolve(searchParams),
        }),
      ).rejects.toThrow("not found");
    }

    expect(mocks.notFound).toHaveBeenCalledTimes(2);
    expect(mocks.getAdminDashboard).not.toHaveBeenCalled();
  });

  it("미리보기 메뉴 이동은 DB 조회 없이 관제·대상자·생활지원사 섹션을 제공한다", async () => {
    const page = await AdminPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ preview: "1" }),
    });
    const html = renderToStaticMarkup(page);
    const navigation = html.match(/<nav[^>]*aria-label="관리자 메뉴"[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? "";

    expect(mocks.getAdminDashboard).not.toHaveBeenCalled();
    expect(mocks.getManagerNotificationFeed).not.toHaveBeenCalled();
    expect(html).toContain('id="dashboard"');
    expect(html).toContain('id="subjects"');
    expect(html).toContain('id="workers"');
    expect(html).toContain('id="reports"');
    expect(html).toContain('id="settings"');
    expect(html).toContain('aria-label="관리자 메뉴"');
    expect(html).toContain('href="/admin/welfare-scan?preview=1"');
    expect(navigation).not.toContain("생활지원사");
    expect(navigation).not.toContain("대상자 관리");
    expect(navigation).not.toContain("통계 및 리포트");
    expect(navigation).not.toContain("설정 관리");
    expect(html).toMatch(
      /<a aria-current="page"[^>]*href="\/admin\?preview=1"[^>]*>[\s\S]*?관제 현황[\s\S]*?<\/a>/,
    );
    expect(html).toContain("김○○");
    expect(html).toContain("이미경");
    expect(html).toContain("미리보기에서는 실데이터 관리 기능을 사용하지 않습니다");
    expect(html).not.toContain('href="/admin/subjects/preview-subject-1');
    expect(html).not.toContain('href="/admin/workers/preview-worker-1');
    expect(html).not.toContain('href="/admin/subjects/new"');
    expect(html).not.toContain('href="/admin/workers/new"');
  });

  it("관제 현황과 복지 스캔은 동일한 상단바·사이드바 셸을 사용한다", async () => {
    const dashboardPage = await AdminPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ preview: "1" }),
    });
    const dashboardHtml = renderToStaticMarkup(dashboardPage);
    const welfareHtml = renderToStaticMarkup(
      <WelfareScanWorkspace previewMode />,
    );
    const shellClass = (html: string, part: "header" | "body") =>
      html.match(new RegExp(`class="([^"]+)" data-admin-shell-part="${part}"`))?.[1];

    expect(shellClass(dashboardHtml, "header")).toBeTruthy();
    expect(shellClass(dashboardHtml, "header")).toBe(
      shellClass(welfareHtml, "header"),
    );
    expect(shellClass(dashboardHtml, "body")).toBe(
      shellClass(welfareHtml, "body"),
    );

    const topBarClass = (html: string) =>
      html.match(/class="([^"]+)" data-admin-topbar="true"/)?.[1];
    expect(topBarClass(dashboardHtml)).toBeTruthy();
    expect(topBarClass(dashboardHtml)).toBe(topBarClass(welfareHtml));
  });

  it("핵심 위젯과 위험도 우선 대상을 텍스트로도 제공한다", () => {
    const summary = {
      total: 3,
      open: 2,
      openCritical: 1,
      visitQueued: 1,
      completed: 1,
    };
    const html = renderToStaticMarkup(
      <>
        <SummaryCards summary={summary} />
        <PriorityList
          subjects={Array.from({ length: 7 }, (_, index) =>
            ({
              subjectId: `subject-${index + 1}`,
              name: index === 0 ? "김○○" : `대상자${index + 1}`,
              phone: "010-0000-0101",
              birthYear: 1938,
              workerId: "worker-1",
              workerName: "이담당",
              workerPhone: "010-0000-0001",
              buildingId: "building-1",
              address: "대구광역시 서구 비산동 1",
              lat: 35.87,
              lng: 128.56,
              grade: 1,
              score: 31.5,
              reasons: ["1938년생 (88세)·독거"],
              status: HouseholdStatus.UNCHECKED,
              statusLabel: HOUSEHOLD_STATUS_LABEL[HouseholdStatus.UNCHECKED],
              open: true,
            }),
          )}
        />
      </>,
    );

    expect(html).toContain("미확인 심각");
    expect(html).toContain("김○○");
    expect(html).toContain("대상자7");
    expect(html).toContain("이담당");
    expect(html).toContain("미확인");
    expect(html).toContain("1938년생 (88세)·독거");
    expect(html).toContain('href="/admin/subjects/subject-1"');
    expect(html).toContain('href="/admin/subjects/subject-1/edit"');
  });

  it("비경보일에는 위험도를 만들지 않고 침묵 상태를 안내한다", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardView
        dashboard={{
          alerted: false,
          date: "2026-08-22",
          dateLabel: "8월 22일(토)",
          selectedWorkerId: null,
          roster: {
            workers: [
              {
                id: "worker-1",
                name: "이담당",
                phone: "010-0000-0001",
                subjectCount: 1,
              },
            ],
            subjects: [
              {
                subjectId: "subject-1",
                name: "비경보일 대상자",
                phone: "010-0000-0101",
                birthYear: 1938,
                workerId: "worker-1",
                workerName: "이담당",
                buildingId: "building-1",
                address: "대구광역시 서구 비산동 1",
              },
            ],
          },
          workers: [],
          generatedAt: "2026-08-22T08:00:00.000Z",
          subjects: [],
          buildings: [],
        }}
        mapKey=""
      />,
    );

    expect(html).toContain("오늘은 경보가 없습니다");
    expect(html).not.toContain("심각 0명");
    expect(html).toContain("대상자 관리");
    expect(html).toContain("생활지원사 관리");
    expect(html).toContain("비경보일 대상자");
    expect(html).toContain("경보 없음");
    expect(html).not.toContain("오늘의 관제 요약");
    expect(html).toContain('aria-label="현재 날씨"');
  });

  it("경보 상태 필터는 원장 대상자에도 적용한다", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardView
        dashboard={{
          alerted: true,
          date: "2026-08-22",
          dateLabel: "8월 22일(토)",
          selectedWorkerId: null,
          roster: {
            workers: [
              {
                id: "worker-1",
                name: "이담당",
                phone: "010-0000-0001",
                subjectCount: 2,
              },
            ],
            subjects: [
              {
                subjectId: "subject-included",
                name: "상태 필터 포함 대상자",
                phone: "010-0000-0101",
                birthYear: 1938,
                workerId: "worker-1",
                workerName: "이담당",
                buildingId: "building-1",
                address: "대구광역시 서구 비산동 1",
              },
              {
                subjectId: "subject-excluded",
                name: "상태 필터 제외 대상자",
                phone: "010-0000-0102",
                birthYear: 1948,
                workerId: "worker-1",
                workerName: "이담당",
                buildingId: "building-2",
                address: "대구광역시 서구 비산동 2",
              },
            ],
          },
          workers: [{ id: "worker-1", name: "이담당" }],
          generatedAt: "2026-08-22T08:00:00.000Z",
          level: AlertLevel.EMERGENCY,
          levelLabel: "비상",
          feelsLikeMax: 38.4,
          summary: {
            total: 1,
            open: 1,
            openCritical: 1,
            visitQueued: 1,
            completed: 0,
          },
          subjects: [
            {
              subjectId: "subject-included",
              name: "상태 필터 포함 대상자",
              phone: "010-0000-0101",
              birthYear: 1938,
              workerId: "worker-1",
              workerName: "이담당",
              workerPhone: "010-0000-0001",
              buildingId: "building-1",
              address: "대구광역시 서구 비산동 1",
              lat: 35.87,
              lng: 128.56,
              grade: 1,
              score: 31.5,
              reasons: ["오늘 비상 단계"],
              status: HouseholdStatus.VISIT_QUEUED,
              statusLabel: HOUSEHOLD_STATUS_LABEL[HouseholdStatus.VISIT_QUEUED],
              open: true,
            },
          ],
          buildings: [],
        }}
        filters={{ selectedStatuses: [HouseholdStatus.VISIT_QUEUED] }}
        mapKey=""
      />,
    );

    expect(html).toContain("상태 필터 포함 대상자");
    expect(html).not.toContain("상태 필터 제외 대상자");
  });

  it("레퍼런스의 관제 패널을 실제 도메인 데이터로 제공한다", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardView
        dashboard={{
          alerted: true,
          date: "2026-08-22",
          dateLabel: "8월 22일(토)",
          selectedWorkerId: null,
          roster: {
            workers: [
              {
                id: "worker-1",
                name: "이담당",
                phone: "010-0000-0001",
                subjectCount: 1,
              },
            ],
            subjects: [
              {
                subjectId: "subject-1",
                name: "김○○",
                phone: "010-0000-0101",
                birthYear: 1938,
                workerId: "worker-1",
                workerName: "이담당",
                buildingId: "building-1",
                address: "대구광역시 서구 비산동 1",
              },
            ],
          },
          workers: [{ id: "worker-1", name: "이담당" }],
          generatedAt: "2026-08-22T05:32:00.000Z",
          level: AlertLevel.EMERGENCY,
          levelLabel: "비상",
          feelsLikeMax: 38.4,
          summary: {
            total: 1,
            open: 1,
            openCritical: 1,
            visitQueued: 1,
            completed: 0,
          },
          subjects: [
            {
              subjectId: "subject-1",
              name: "김○○",
              phone: "010-0000-0101",
              birthYear: 1938,
              workerId: "worker-1",
              workerName: "이담당",
              workerPhone: "010-0000-0001",
              buildingId: "building-1",
              address: "대구광역시 서구 비산동 1",
              lat: 35.87,
              lng: 128.56,
              grade: 1,
              score: 31.5,
              reasons: ["1938년생 (88세)·독거", "오늘 비상 단계"],
              status: HouseholdStatus.VISIT_QUEUED,
              statusLabel:
                HOUSEHOLD_STATUS_LABEL[HouseholdStatus.VISIT_QUEUED],
              open: true,
            },
          ],
          buildings: Array.from({ length: 6 }, (_, index) =>
            ({
              buildingId: `building-${index + 1}`,
              address: `대구광역시 서구 비산동 ${index + 1}`,
              lat: 35.87,
              lng: 128.56,
              grade: 1,
              score: 31.5,
              statusCategory: "visit",
              openCount: 1,
              subjects: [],
            }),
          ),
        }}
        mapKey=""
      />,
    );

    expect(html).toContain("건물별 미처리 현황");
    expect(html).toContain("비산동 6");
    expect(html).toContain("생활지원사 관리");
    expect(html).toContain("대상자 등록");
    expect(html).toContain("생활지원사 등록");
    expect(html).toContain('href="/admin/subjects/new"');
    expect(html).toContain('href="/admin/workers/new"');
    expect(html).toContain('href="/admin/welfare-scan"');
    expect(html).toContain('href="/admin/workers/worker-1?date=2026-08-22"');
    expect(html).not.toContain("010-0000-0101");
    expect(html).toContain("010-****-0001");
    expect(html).toContain('aria-label="대상자 검색"');
    expect(html).toContain('aria-label="대상자 상태"');
    expect(html).toContain("담당자 검색");
    expect(html).toContain("calendar.png");
    expect(html).toContain("location.png");
    expect(html).toContain("clock.png");
    expect(html).toContain("refresh.png");
    expect(html).toContain("person.png");
    expect(html).toContain("phone.png");
    expect(html).toContain('aria-label="현재 날씨"');
    expect(html).not.toContain("최고 체감온도");
    expect(html).not.toContain("현재 위치 날씨");
    expect(html).not.toContain("날씨 확인 중");
    expect(html).not.toContain("근무 중");
    expect(html).not.toContain("휴식 중");
  });

  it("상태 범례와 데이터 출처를 텍스트로 함께 제공한다", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardView
        dashboard={{
          alerted: true,
          date: "2026-08-22",
          dateLabel: "8월 22일(토)",
          selectedWorkerId: null,
          roster: { workers: [], subjects: [] },
          workers: [],
          generatedAt: "2026-08-22T08:00:00.000Z",
          level: AlertLevel.WARNING,
          levelLabel: "경계",
          feelsLikeMax: 35,
          summary: {
            total: 1,
            open: 1,
            openCritical: 1,
            visitQueued: 0,
            completed: 0,
          },
          subjects: [],
          buildings: [],
        }}
        mapKey=""
      />,
    );

    expect(html).toContain("상태");
    for (const status of [
      HouseholdStatus.UNCHECKED,
      HouseholdStatus.CALL_OK,
      HouseholdStatus.NO_ANSWER_1,
      HouseholdStatus.VISIT_QUEUED,
      HouseholdStatus.VISITING,
      HouseholdStatus.RESOLVED,
    ]) {
      expect(html).toContain(HOUSEHOLD_STATUS_LABEL[status]);
    }
    expect(html).toContain("기상청 단기예보·특보 API");
    expect(html).toContain("국토부 건축HUB 건축물대장");
    expect(html).toContain("카카오맵 API");
  });

  it("상태 적용은 화면에서 선택한 담당자를 같은 폼으로 제출한다", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardView
        dashboard={{
          alerted: false,
          date: "2026-08-22",
          dateLabel: "8월 22일(토)",
          selectedWorkerId: null,
          roster: {
            workers: [
              {
                id: "worker-1",
                name: "이담당",
                phone: null,
                subjectCount: 0,
              },
            ],
            subjects: [],
          },
          workers: [{ id: "worker-1", name: "이담당" }],
          generatedAt: "2026-08-22T08:00:00.000Z",
          subjects: [],
          buildings: [],
        }}
        mapKey=""
      />,
    );
    const filterFormId = html.indexOf('id="admin-filter-form"');
    const filterFormStart = html.lastIndexOf("<form", filterFormId);
    const filterForm = html.slice(filterFormStart, html.indexOf("</form>", filterFormStart));

    expect(filterFormId).toBeGreaterThan(-1);
    expect(filterForm).toContain('name="workerId"');
    expect(html).toMatch(/form="admin-filter-form"[^>]*name="status"/);
    expect(html).toContain('form="admin-filter-form" type="submit">상태 적용');
  });
});
