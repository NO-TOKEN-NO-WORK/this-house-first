import { describe, expect, it } from "vitest";
import {
  AlertLevel,
  CallResult,
  CheckKind,
  GRADE_PLAN,
  GRADE_SEVERITY_LABEL,
  HouseholdStatus,
  HOUSEHOLD_STATUS_LABEL,
  RiskGrade,
} from "../domain";
import { ReasonCategory } from "../scoring/reasons";
import {
  applyCheckOutcome,
  detailFromBoard,
  findBoardSubject,
  type CheckOutcome,
} from "./detail";
import type { AlertedBoard, BoardSubject } from "./today";

function subject(over: Partial<BoardSubject> = {}): BoardSubject {
  return {
    subjectId: "s1",
    buildingId: "b1",
    name: "김○○",
    age: 88,
    birthYear: 1938,
    livesAlone: true,
    phone: "010-0000-0000",
    address: "전북특별자치도 남원시 도통동 1",
    grade: RiskGrade.HIGH,
    score: 12,
    reasons: ["88세·독거", "1972년 단독주택", "오늘 체감 38도"],
    status: HouseholdStatus.UNCHECKED,
    statusLabel: HOUSEHOLD_STATUS_LABEL[HouseholdStatus.UNCHECKED],
    callAttempts: 0,
    open: true,
    nextCheckKind: CheckKind.CALL,
    lastResult: null,
    lastCheckAtLabel: null,
    roadAddress: "전북특별자치도 남원시 춘향로 1",
    lat: 0,
    lng: 0,
    ...over,
  };
}

function board(row: BoardSubject = subject()): AlertedBoard {
  return {
    alerted: true,
    date: "2026-08-21",
    dateLabel: "8월 21일(금)",
    worker: { id: "w1", name: "박지원" },
    dong: "도통동",
    level: AlertLevel.EMERGENCY,
    levelLabel: "심각",
    feelsLikeMax: 38,
    groups: [
      {
        grade: row.grade,
        gradeLabel: "경계",
        plan: GRADE_PLAN[row.grade],
        subjects: [row],
      },
    ],
    summary: {
      total: 1,
      open: 1,
      openCritical: 0,
      visitQueued: 0,
      openByGrade: {
        [RiskGrade.CRITICAL]: 0,
        [RiskGrade.HIGH]: 1,
        [RiskGrade.MODERATE]: 0,
      },
    },
  };
}

describe("detailFromBoard", () => {
  it("보드에 있는 대상자·사유를 상세 형태로 옮긴다 — 사유 문장은 그대로다", () => {
    const row = subject();
    const detail = detailFromBoard(row, board(row));

    expect(detail.subjectId).toBe("s1");
    expect(detail.name).toBe("김○○");
    expect(detail.phone).toBe("010-0000-0000");
    expect(detail.alerted).toBe(true);
    expect(detail.levelLabel).toBe("심각");
    expect(detail.feelsLikeMax).toBe(38);
    expect(detail.nextCheckKind).toBe(CheckKind.CALL);
    expect(detail.assessment?.plan).toBe(GRADE_PLAN[RiskGrade.HIGH]);
    expect(detail.assessment?.severityLabel).toBe(
      GRADE_SEVERITY_LABEL[RiskGrade.HIGH],
    );
    expect(detail.assessment?.reasons.map((r) => r.text)).toEqual(row.reasons);
    expect(detail.assessment?.reasons.map((r) => r.category)).toEqual([
      ReasonCategory.PERSONAL,
      ReasonCategory.BUILDING,
      ReasonCategory.WEATHER,
    ]);
  });

  it("심각·방문 대기 가구는 전화가 아니라 방문 기록을 받는다", () => {
    const row = subject({
      grade: RiskGrade.CRITICAL,
      status: HouseholdStatus.VISIT_QUEUED,
      statusLabel: HOUSEHOLD_STATUS_LABEL[HouseholdStatus.VISIT_QUEUED],
      nextCheckKind: CheckKind.VISIT,
    });
    const detail = detailFromBoard(row, board(row));
    expect(detail.nextCheckKind).toBe(CheckKind.VISIT);
    expect(detail.assessment?.plan).toBe(GRADE_PLAN[RiskGrade.CRITICAL]);
  });

  it("오늘 마지막 기록값을 그대로 실어 선택됨 표시에 쓴다", () => {
    const row = subject({
      status: HouseholdStatus.NO_ANSWER_1,
      statusLabel: HOUSEHOLD_STATUS_LABEL[HouseholdStatus.NO_ANSWER_1],
      callAttempts: 1,
      lastResult: CallResult.NO_ANSWER,
    });
    expect(detailFromBoard(row, board(row)).lastResult).toBe(
      CallResult.NO_ANSWER,
    );
  });
});

describe("findBoardSubject", () => {
  it("위험 단계 그룹을 가로질러 대상자를 찾는다", () => {
    const row = subject({ subjectId: "s-critical", grade: RiskGrade.CRITICAL });
    const found = findBoardSubject(board(row), "s-critical");
    expect(found?.name).toBe("김○○");
    expect(findBoardSubject(board(row), "missing")).toBeNull();
  });
});

describe("applyCheckOutcome", () => {
  it("전화 정상이면 그날 기록을 닫는다", () => {
    const row = subject();
    const before = detailFromBoard(row, board(row));
    const outcome: CheckOutcome = {
      status: HouseholdStatus.CALL_OK,
      statusLabel: HOUSEHOLD_STATUS_LABEL[HouseholdStatus.CALL_OK],
      callAttempts: 1,
      result: CallResult.OK,
    };
    const after = applyCheckOutcome(before, outcome);
    expect(after.nextCheckKind).toBeNull();
    expect(after.open).toBe(false);
    expect(after.status).toBe(HouseholdStatus.CALL_OK);
    expect(after.lastResult).toBe(CallResult.OK);
    expect(after.assessment?.reasons).toEqual(before.assessment?.reasons);
  });

  it("이상 징후면 같은 화면에서 방문 기록을 받게 승격한다", () => {
    const before = detailFromBoard(subject(), board());
    const after = applyCheckOutcome(before, {
      status: HouseholdStatus.VISIT_QUEUED,
      statusLabel: HOUSEHOLD_STATUS_LABEL[HouseholdStatus.VISIT_QUEUED],
      callAttempts: 1,
      result: CallResult.SYMPTOM,
    });
    expect(after.nextCheckKind).toBe(CheckKind.VISIT);
    expect(after.open).toBe(true);
    expect(after.lastResult).toBe(CallResult.SYMPTOM);
  });
});
