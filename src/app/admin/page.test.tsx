import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HouseholdStatus, HOUSEHOLD_STATUS_LABEL } from "../../lib/domain";
import { AdminDashboardView, PriorityList, SummaryCards } from "./page";

describe("관리자 관제 화면", () => {
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
          subjects={[
            {
              subjectId: "subject-1",
              name: "김○○",
              workerId: "worker-1",
              workerName: "이담당",
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
            },
          ]}
        />
      </>,
    );

    expect(html).toContain("미확인 1등급");
    expect(html).toContain("김○○");
    expect(html).toContain("이담당");
    expect(html).toContain("미확인");
    expect(html).toContain("1938년생 (88세)·독거");
  });

  it("비경보일에는 위험도를 만들지 않고 침묵 상태를 안내한다", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardView
        dashboard={{
          alerted: false,
          date: "2026-08-22",
          dateLabel: "8월 22일(토)",
          selectedWorkerId: null,
          workers: [],
          generatedAt: "2026-08-22T08:00:00.000Z",
          subjects: [],
          buildings: [],
        }}
        mapKey=""
      />,
    );

    expect(html).toContain("오늘은 경보가 없습니다");
    expect(html).not.toContain("1등급 0명");
  });
});
