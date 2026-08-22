import { describe, expect, it } from "vitest";
import { HouseholdStatus } from "../domain";
import {
  buildAdminSnapshot,
  type AdminAssessmentRow,
  type AdminStatusRow,
} from "./dashboard";

const assessments: AdminAssessmentRow[] = [
  {
    subjectId: "subject-critical",
    score: 31.5,
    grade: 1,
    reasons: JSON.stringify(["1938년생 (88세)·독거", "오늘 비상 단계"]),
    subject: {
      id: "subject-critical",
      name: "김○○",
      phone: "010-0000-0101",
      birthYear: 1938,
      workerId: "worker-a",
      worker: { name: "이담당", phone: "010-0000-0001" },
      building: {
        id: "building-a",
        address: "대구광역시 서구 비산동 1",
        roadAddress: null,
        lat: 35.87,
        lng: 128.56,
      },
    },
  },
  {
    subjectId: "subject-visit",
    score: 12,
    grade: 2,
    reasons: JSON.stringify(["1948년생 (78세)", "오늘 비상 단계"]),
    subject: {
      id: "subject-visit",
      name: "박○○",
      phone: "010-0000-0102",
      birthYear: 1948,
      workerId: "worker-a",
      worker: { name: "이담당", phone: "010-0000-0001" },
      building: {
        id: "building-a",
        address: "대구광역시 서구 비산동 1",
        roadAddress: null,
        lat: 35.87,
        lng: 128.56,
      },
    },
  },
  {
    subjectId: "subject-closed",
    score: 26,
    grade: 1,
    reasons: "not-json",
    subject: {
      id: "subject-closed",
      name: "최○○",
      phone: null,
      birthYear: 1945,
      workerId: "worker-b",
      worker: { name: "박담당", phone: null },
      building: {
        id: "building-b",
        address: "대구광역시 서구 비산동 2",
        roadAddress: "대구광역시 서구 비산로 2",
        lat: 35.88,
        lng: 128.57,
      },
    },
  },
];

const statuses: AdminStatusRow[] = [
  { subjectId: "subject-visit", status: HouseholdStatus.VISIT_QUEUED },
  { subjectId: "subject-closed", status: HouseholdStatus.CALL_OK },
];

describe("buildAdminSnapshot", () => {
  it("미확인 1등급·방문 대기·건물 최고 위험도를 같은 행 집합에서 계산한다", () => {
    const result = buildAdminSnapshot({ assessments, statuses });

    expect(result.summary).toEqual({
      total: 3,
      open: 2,
      openCritical: 1,
      visitQueued: 1,
      completed: 1,
    });
    expect(result.subjects.map((subject) => subject.subjectId)).toEqual([
      "subject-critical",
      "subject-visit",
      "subject-closed",
    ]);
    expect(result.subjects[0]?.status).toBe(HouseholdStatus.UNCHECKED);
    expect(result.subjects[0]).toMatchObject({
      phone: "010-0000-0101",
      birthYear: 1938,
      workerPhone: "010-0000-0001",
    });
    expect(result.subjects[2]?.reasons).toEqual([
      "위험 사유를 불러오지 못했습니다",
    ]);
    expect(result.buildings[0]).toMatchObject({
      buildingId: "building-a",
      grade: 1,
      score: 31.5,
      statusCategory: "visit",
      openCount: 2,
    });
  });

  it("담당자 필터는 다른 담당자의 데이터를 섞지 않는다", () => {
    const result = buildAdminSnapshot({
      assessments,
      statuses,
      workerId: "worker-b",
    });

    expect(result.summary.total).toBe(1);
    expect(result.subjects.map((subject) => subject.workerName)).toEqual([
      "박담당",
    ]);
    expect(result.buildings.map((building) => building.buildingId)).toEqual([
      "building-b",
    ]);
  });
});
