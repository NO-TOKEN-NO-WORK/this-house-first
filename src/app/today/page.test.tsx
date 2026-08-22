import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GradeFilter } from "@/components/today/GradeFilter";
import type {
  AlertedBoard,
  BoardSubject,
  SilentBoard,
} from "@/lib/board/today";
import {
  AlertLevel,
  CheckKind,
  HouseholdStatus,
  RiskGrade,
} from "@/lib/domain";

const { getBoard } = vi.hoisted(() => ({ getBoard: vi.fn() }));

vi.mock("@/lib/board/today", () => ({ getBoard }));

import TodayPage from "./page";

function subject(name: string, grade: 1 | 2 | 3): BoardSubject {
  return {
    subjectId: `subject-${grade}`,
    buildingId: `building-${grade}`,
    name,
    age: 80,
    birthYear: 1946,
    livesAlone: true,
    phone: "010-0000-0000",
    address: "대구광역시 서구 비산동 1",
    grade,
    score: 10,
    reasons: ["테스트 위험 사유"],
    status: HouseholdStatus.UNCHECKED,
    statusLabel: "미확인",
    callAttempts: 0,
    open: true,
    nextCheckKind: grade === RiskGrade.CRITICAL ? CheckKind.VISIT : CheckKind.CALL,
    lastResult: null,
    roadAddress: null,
    lat: 35.8,
    lng: 128.5,
  };
}

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
      subjects: [subject("1등급 대상자", RiskGrade.CRITICAL)],
    },
    {
      grade: RiskGrade.HIGH,
      gradeLabel: "2등급",
      plan: "오전 중 전화",
      subjects: [subject("2등급 대상자", RiskGrade.HIGH)],
    },
    {
      grade: RiskGrade.MODERATE,
      gradeLabel: "3등급",
      plan: "15시 이전 전화",
      subjects: [subject("3등급 대상자", RiskGrade.MODERATE)],
    },
  ],
  summary: {
    total: 3,
    open: 3,
    openCritical: 1,
    visitQueued: 1,
    openByGrade: { 1: 1, 2: 1, 3: 1 },
  },
};

const silentBoard: SilentBoard = {
  alerted: false,
  date: "2026-08-22",
  dateLabel: "8월 22일(토)",
  worker: { id: "worker-1", name: "담당자" },
  dong: "비산동",
  subjects: [
    {
      subjectId: "silent-subject",
      buildingId: "silent-building",
      name: "비경보일 대상자",
      age: 80,
      livesAlone: true,
      phone: "010-0000-0000",
      address: "대구광역시 서구 비산동 1",
      roadAddress: null,
      lat: 35.8,
      lng: 128.5,
    },
  ],
};

function findGradeFilter(node: ReactNode): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findGradeFilter(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (node.type === GradeFilter) return node;
  return findGradeFilter(node.props.children);
}

describe("TodayPage 등급 필터", () => {
  it("등급 메뉴를 버튼으로 렌더링해 서버 페이지 이동을 만들지 않는다", async () => {
    getBoard.mockResolvedValue(board);

    const html = renderToStaticMarkup(
      await TodayPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ date: "2026-08-21" }),
      }),
    );
    const tabs = html.match(
      /<nav aria-label="등급 필터"[^>]*>(.*?)<\/nav>/,
    )?.[1];

    expect(tabs).toContain("<button");
    expect(tabs).not.toContain("<a ");
  });

  it("서버에서 받은 등급이 바뀌면 필터를 새 상태로 마운트한다", async () => {
    getBoard.mockResolvedValue(board);

    const page = await TodayPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ grade: "2" }),
    });

    expect(findGradeFilter(page)?.key).toBe("2");
  });

  it("비경보일에는 등급 필터 없이 담당 가구를 표시한다", async () => {
    getBoard.mockResolvedValue(silentBoard);

    const html = renderToStaticMarkup(
      await TodayPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ date: "2026-08-22" }),
      }),
    );

    expect(html).toContain("오늘은 경보가 없습니다");
    expect(html).toContain("비경보일 대상자");
    expect(html).not.toContain('aria-label="등급 필터"');
  });
});
