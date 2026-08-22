import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GradeFilter } from "@/components/today/GradeFilter";
import { TodayAppSettings } from "@/components/today/TodayAppSettings";
import type {
  AlertedBoard,
  BoardSubject,
  SilentBoard,
} from "@/lib/board/today";
import {
  ALERT_LEVEL_LABEL,
  AlertLevel,
  CheckKind,
  HouseholdStatus,
  RiskGrade,
} from "@/lib/domain";

const { getBoard } = vi.hoisted(() => ({ getBoard: vi.fn() }));

vi.mock("@/lib/board/today", () => ({ getBoard }));

/*
 * `TodayWorkspace`가 저장 후 보드를 다시 받으려고 `useRouter`를 쓴다.
 * 테스트에는 앱 라우터가 없으므로 그 훅만 대신하고 `notFound` 등은 실제 것을 쓴다.
 */
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));

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
    lastCheckKind: null,
    lastCheckAtLabel: null,
    roadAddress: null,
    lat: 35.8,
    lng: 128.5,
  };
}

const board: AlertedBoard = {
  alerted: true,
  isDemo: true,
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
      gradeLabel: "심각",
      plan: "전화 생략 · 오전 방문",
      subjects: [subject("심각 대상자", RiskGrade.CRITICAL)],
    },
    {
      grade: RiskGrade.HIGH,
      gradeLabel: "경계",
      plan: "오전 중 전화",
      subjects: [subject("경계 대상자", RiskGrade.HIGH)],
    },
    {
      grade: RiskGrade.MODERATE,
      gradeLabel: "주의",
      plan: "15시 이전 전화",
      subjects: [subject("주의 대상자", RiskGrade.MODERATE)],
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

function findAppSettings(node: ReactNode): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findAppSettings(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (node.type === TodayAppSettings) return node;
  return findAppSettings(node.props.children);
}

describe("TodayPage 위험 단계 필터", () => {
  it("경보 여부와 무관하게 현재 날씨를 표시하지 않는다", async () => {
    for (const currentBoard of [board, silentBoard]) {
      getBoard.mockResolvedValue(currentBoard);

      const html = renderToStaticMarkup(
        await TodayPage({
          params: Promise.resolve({}),
          searchParams: Promise.resolve({}),
        }),
      );

      expect(html).not.toContain('aria-label="현재 날씨"');
    }
  });

  it("설치와 알림을 대상자 목록 뒤의 앱 설정 진입점에 둔다", async () => {
    getBoard.mockResolvedValue(board);

    const page = await TodayPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ date: "2026-08-21" }),
    });
    const html = renderToStaticMarkup(page);

    expect(findAppSettings(page)?.props).toMatchObject({ workerId: "worker-1" });
    expect(html).toContain("<details");
    expect(html).toContain("앱 설정");
    expect(html.indexOf("앱 설정")).toBeGreaterThan(
      html.indexOf("주의 대상자"),
    );
    expect(html).not.toContain("push-toast-dismissed");
  });

  it("위험 단계 메뉴를 버튼으로 렌더링해 서버 페이지 이동을 만들지 않는다", async () => {
    getBoard.mockResolvedValue(board);

    const html = renderToStaticMarkup(
      await TodayPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ date: "2026-08-21" }),
      }),
    );
    const tabs = html.match(
      /<nav aria-label="위험 단계 필터"[^>]*>(.*?)<\/nav>/,
    )?.[1];

    expect(tabs).toContain("<button");
    expect(tabs).not.toContain("<a ");
  });

  it("서버에서 받은 위험 단계가 바뀌면 필터를 새 상태로 마운트한다", async () => {
    getBoard.mockResolvedValue(board);

    const page = await TodayPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ grade: "2" }),
    });

    expect(findGradeFilter(page)?.key).toBe("2");
  });

  it("비상 단계에만 폭염 배너를 띄운다", async () => {
    getBoard.mockResolvedValue(board);

    const html = renderToStaticMarkup(
      await TodayPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ date: "2026-08-21" }),
      }),
    );

    expect(html).toContain("오늘 폭염 비상 단계예요");
  });

  it("주의·경계 단계에서는 배너 색만 바꾸지 않고 아예 감춘다", async () => {
    for (const level of [AlertLevel.ADVISORY, AlertLevel.WARNING] as const) {
      getBoard.mockResolvedValue({
        ...board,
        level,
        levelLabel: ALERT_LEVEL_LABEL[level],
      });

      const html = renderToStaticMarkup(
        await TodayPage({
          params: Promise.resolve({}),
          searchParams: Promise.resolve({ date: "2026-08-21" }),
        }),
      );

      expect(html).not.toContain("단계예요");
      // 배너가 빠져도 요약 카드는 그대로 있어야 한다 (Figma 133:3213)
      expect(html).toContain("확인 완료");
    }
  });

  it("비경보일에는 위험 단계 필터 없이 담당 가구를 표시한다", async () => {
    getBoard.mockResolvedValue(silentBoard);

    const html = renderToStaticMarkup(
      await TodayPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ date: "2026-08-22" }),
      }),
    );

    expect(html).toContain("오늘은 경보가 없습니다");
    expect(html).toContain("비경보일 대상자");
    expect(html).not.toContain('aria-label="위험 단계 필터"');
  });
});
