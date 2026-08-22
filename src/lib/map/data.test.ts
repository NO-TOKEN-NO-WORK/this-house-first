import { describe, expect, it } from "vitest";
import { AlertLevel, CheckKind, HouseholdStatus, RiskGrade } from "../domain";
import type { Board } from "../board/today";
import { toMapBuildings } from "./data";

describe("toMapBuildings", () => {
  it("같은 건물을 합치고 가장 높은 위험 등급과 원본 사유를 보존한다", () => {
    const board: Board = {
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
              name: "김○○",
              age: 88,
              livesAlone: true,
              phone: null,
              address: "대구광역시 서구 비산동 1",
              roadAddress: null,
              lat: 35.87,
              lng: 128.57,
              grade: RiskGrade.CRITICAL,
              score: 31.5,
              reasons: ["88세", "1980년 이전 건축"],
              status: HouseholdStatus.VISIT_QUEUED,
              statusLabel: "방문 대기",
              callAttempts: 0,
              open: true,
              nextCheckKind: CheckKind.VISIT,
            },
          ],
        },
        {
          grade: RiskGrade.HIGH,
          gradeLabel: "2등급",
          plan: "오전 중 전화",
          subjects: [
            {
              subjectId: "subject-2",
              buildingId: "building-1",
              name: "이○○",
              age: 79,
              livesAlone: false,
              phone: null,
              address: "대구광역시 서구 비산동 1",
              roadAddress: null,
              lat: 35.87,
              lng: 128.57,
              grade: RiskGrade.HIGH,
              score: 12,
              reasons: ["79세"],
              status: HouseholdStatus.UNCHECKED,
              statusLabel: "미확인",
              callAttempts: 0,
              open: true,
              nextCheckKind: CheckKind.CALL,
            },
          ],
        },
      ],
      summary: {
        total: 2,
        open: 2,
        openCritical: 1,
        visitQueued: 1,
        openByGrade: { 1: 1, 2: 1, 3: 0 },
      },
    };

    expect(toMapBuildings(board)).toEqual([
      expect.objectContaining({
        buildingId: "building-1",
        grade: RiskGrade.CRITICAL,
        score: 31.5,
        households: [
          expect.objectContaining({ reasons: ["88세", "1980년 이전 건축"] }),
          expect.objectContaining({ reasons: ["79세"] }),
        ],
      }),
    ]);
  });

  it("비경보일 가구에는 등급·상태·사유를 만들지 않는다", () => {
    const board: Board = {
      alerted: false,
      date: "2026-08-22",
      dateLabel: "8월 22일(토)",
      worker: { id: "worker-1", name: "담당자" },
      dong: "비산동",
      subjects: [
        {
          subjectId: "subject-1",
          buildingId: "building-1",
          name: "김○○",
          age: 88,
          livesAlone: true,
          phone: null,
          address: "대구광역시 서구 비산동 1",
          roadAddress: null,
          lat: 35.87,
          lng: 128.57,
        },
      ],
    };

    expect(toMapBuildings(board)[0]).toMatchObject({
      grade: null,
      score: null,
      households: [{ grade: null, status: null, statusLabel: null, reasons: [] }],
    });
  });
});
