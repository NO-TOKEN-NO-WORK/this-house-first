import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardGroup, BoardSubject } from "@/lib/board/today";
import {
  CheckKind,
  HouseholdStatus,
  RiskGrade,
  type RiskGrade as RiskGradeValue,
} from "@/lib/domain";

const state = vi.hoisted(() => ({
  useState: vi.fn(),
  setSelectedGrade: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: state.useState,
}));

import { GradeFilter } from "./GradeFilter";

type ElementProps = {
  children?: ReactNode;
  onClick?: () => void;
  returnGrade?: RiskGradeValue;
  retryNote?: string;
};

function childrenOf(element: ReactElement<ElementProps>) {
  const children = Array.isArray(element.props.children)
    ? element.props.children
    : [element.props.children];
  return children.filter(isValidElement) as ReactElement<ElementProps>[];
}

function subject(name: string, grade: RiskGradeValue): BoardSubject {
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
    nextCheckKind:
      grade === RiskGrade.CRITICAL ? CheckKind.VISIT : CheckKind.CALL,
    lastResult: null,
    lastCheckKind: null,
    lastCheckAtLabel: null,
    roadAddress: null,
    lat: 35.8,
    lng: 128.5,
  };
}

const groups: BoardGroup[] = [
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
];

const props = {
  groups,
  initialGrade: null,
  date: "2026-08-21",
  workerId: "worker-1",
} as const;

describe("GradeFilter", () => {
  beforeEach(() => {
    state.useState.mockReturnValue([null, state.setSelectedGrade]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    [0, null, "/today?date=2026-08-21&workerId=worker-1"],
    [2, RiskGrade.HIGH, "/today?date=2026-08-21&workerId=worker-1&grade=2"],
  ] as const)(
    "위험 단계 버튼 %i 클릭은 로컬 상태와 URL만 바꾼다",
    (buttonIndex, grade, expectedUrl) => {
      const replaceState = vi.fn();
      const fetch = vi.fn();
      vi.stubGlobal("window", {
        location: {
          pathname: "/today",
          search: "?date=2026-08-21&workerId=worker-1&grade=1",
        },
        history: { replaceState },
      });
      vi.stubGlobal("fetch", fetch);

      const [nav] = childrenOf(GradeFilter(props));
      childrenOf(nav)[buttonIndex]?.props.onClick?.();

      expect(state.setSelectedGrade).toHaveBeenCalledWith(grade);
      expect(replaceState).toHaveBeenCalledWith(null, "", expectedUrl);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    [null, ["1", "2", "3"]],
    [RiskGrade.CRITICAL, ["1"]],
    [RiskGrade.HIGH, ["2"]],
    [RiskGrade.MODERATE, ["3"]],
  ] as const)("선택 위험 단계 %s에 맞는 목록만 표시한다", (grade, expected) => {
    state.useState.mockReturnValue([grade, state.setSelectedGrade]);

    const [, list] = childrenOf(GradeFilter(props));

    expect(childrenOf(list).map((section) => section.key)).toEqual(expected);
  });

  function firstCardOf(props: Parameters<typeof GradeFilter>[0]) {
    const [, list] = childrenOf(GradeFilter(props));
    const [section] = childrenOf(list);
    const [, subjects] = childrenOf(section!);
    return childrenOf(subjects!)[0]!;
  }

  it("무응답 1회로 멈춘 가구는 진행 한 줄을 카드에 넘긴다", () => {
    const waiting = {
      ...subject("최덕례", RiskGrade.HIGH),
      status: HouseholdStatus.NO_ANSWER_1,
      statusLabel: "무응답 1회",
      callAttempts: 1,
      lastCheckAtLabel: "9시 10분",
    };
    const grouped = [{ ...groups[1]!, subjects: [waiting] }];
    state.useState.mockReturnValue([RiskGrade.HIGH, state.setSelectedGrade]);

    expect(firstCardOf({ ...props, groups: grouped }).props.retryNote).toBe(
      "무응답 1회 · 9시 10분",
    );
  });

  it("기록 시각을 모르면 상태 이름만 넘긴다", () => {
    const waiting = {
      ...subject("최덕례", RiskGrade.HIGH),
      status: HouseholdStatus.NO_ANSWER_1,
      statusLabel: "무응답 1회",
      lastCheckAtLabel: null,
    };
    const grouped = [{ ...groups[1]!, subjects: [waiting] }];
    state.useState.mockReturnValue([RiskGrade.HIGH, state.setSelectedGrade]);

    expect(firstCardOf({ ...props, groups: grouped }).props.retryNote).toBe(
      "무응답 1회",
    );
  });

  it("아직 손대지 않은 가구에는 진행 한 줄을 붙이지 않는다", () => {
    state.useState.mockReturnValue([RiskGrade.HIGH, state.setSelectedGrade]);

    expect(firstCardOf(props).props.retryNote).toBeUndefined();
  });

  it("현재 위험 단계를 대상자 상세 링크에 넘긴다", () => {
    state.useState.mockReturnValue([
      RiskGrade.HIGH,
      state.setSelectedGrade,
    ]);

    const [, list] = childrenOf(GradeFilter(props));
    const [section] = childrenOf(list);
    const [, subjects] = childrenOf(section);
    const [card] = childrenOf(subjects);

    expect(card.props.returnGrade).toBe(RiskGrade.HIGH);
  });
});
