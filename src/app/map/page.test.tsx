import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AlertedBoard, SilentBoard } from "@/lib/board/today";
import { AlertLevel, CheckKind, HouseholdStatus, RiskGrade } from "@/lib/domain";

const { getBoard } = vi.hoisted(() => ({ getBoard: vi.fn() }));

vi.mock("@/lib/board/today", () => ({ getBoard }));

import MapPage from "./page";

const board: AlertedBoard = {
  alerted: true,
  date: "2026-08-21",
  dateLabel: "8월 21일(금)",
  worker: { id: "worker-1", name: "담당자" },
  dong: "비산동",
  level: AlertLevel.EMERGENCY,
  levelLabel: "비상",
  feelsLikeMax: 38,
  groups: [
    {
      grade: RiskGrade.CRITICAL,
      gradeLabel: "1등급",
      plan: "전화 생략 · 오전 방문",
      subjects: [
        {
          subjectId: "subject-1",
          buildingId: "building-1",
          name: "합성 대상자",
          age: 88,
          birthYear: 1938,
          livesAlone: true,
          phone: "010-0000-0000",
          address: "대구광역시 서구 비산동 1",
          roadAddress: "대구광역시 서구 달서로 1",
          lat: 35.8,
          lng: 128.5,
          grade: RiskGrade.CRITICAL,
          score: 31.5,
          reasons: ["1938년생 (88세)·독거"],
          status: HouseholdStatus.VISIT_QUEUED,
          statusLabel: "방문 대기",
          callAttempts: 0,
          open: true,
          nextCheckKind: CheckKind.VISIT,
          lastResult: null,
          lastCheckAtLabel: null,
        },
      ],
    },
  ],
  summary: {
    total: 1,
    open: 1,
    openCritical: 1,
    visitQueued: 1,
    openByGrade: { 1: 1, 2: 0, 3: 0 },
  },
};

describe("MapPage 방문 동선", () => {
  it("Figma 방문 동선 구조와 도메인 문구를 표시한다", async () => {
    getBoard.mockResolvedValue(board);

    const html = renderToStaticMarkup(
      await MapPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ date: "2026-08-21", workerId: "worker-1" }),
      }),
    );

    expect(html).toContain("방문 동선");
    expect(html).toContain("예상 이동 0분 · 총 1가구");
    expect(html).toContain("합성 대상자");
    expect(html).toContain("88세 · 독거");
    expect(html).toContain("심각");
    expect(html).toContain("대구광역시 서구 달서로 1");
    expect(html).toContain("경로 안내");
    expect(html).toContain("https://map.kakao.com/link/to/");
    expect(html).toContain('aria-current="page"');
  });

  it("비경보일에는 빈 방문 동선을 조용히 표시한다", async () => {
    const silentBoard: SilentBoard = {
      alerted: false,
      date: "2026-08-22",
      dateLabel: "8월 22일(토)",
      worker: { id: "worker-1", name: "담당자" },
      dong: "비산동",
      subjects: [],
    };
    getBoard.mockResolvedValue(silentBoard);

    const html = renderToStaticMarkup(
      await MapPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ date: "2026-08-22" }),
      }),
    );

    expect(html).toContain("지금 방문할 가구가 없습니다");
    expect(html).toContain("예상 이동 0분 · 총 0가구");
  });
});
