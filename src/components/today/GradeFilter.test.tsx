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
    roadAddress: null,
    lat: 35.8,
    lng: 128.5,
  };
}

const groups: BoardGroup[] = [
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
    "등급 버튼 %i 클릭은 로컬 상태와 URL만 바꾼다",
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
  ] as const)("선택 등급 %s에 맞는 목록만 표시한다", (grade, expected) => {
    state.useState.mockReturnValue([grade, state.setSelectedGrade]);

    const [, list] = childrenOf(GradeFilter(props));

    expect(childrenOf(list).map((section) => section.key)).toEqual(expected);
  });

  it("현재 등급을 대상자 상세 링크에 넘긴다", () => {
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
