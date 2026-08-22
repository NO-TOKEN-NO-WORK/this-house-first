import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HouseholdStatus, HOUSEHOLD_STATUS_LABEL } from "../../lib/domain";
import { AdminDashboardView, PriorityList, SummaryCards } from "./page";

const adminStyles = readFileSync(
  new URL("./admin.module.css", import.meta.url),
  "utf8",
);

describe("관리자 관제 화면", () => {
  it("브랜드 링크를 한 줄로 유지하고 미실행 viewport QA를 통과로 표기하지 않는다", () => {
    expect(adminStyles).toMatch(/\.brand\s*\{[^}]*white-space:\s*nowrap;/);
    expect(adminStyles).toContain(
      "responsive: implementation-pass (49; viewport QA unavailable)",
    );
    expect(adminStyles).toContain(
      "mobile: implementation-pass (34, 49, 50–57; viewport QA unavailable)",
    );
    expect(adminStyles).not.toContain("responsive: pass");
    expect(adminStyles).not.toContain("mobile: pass");
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
