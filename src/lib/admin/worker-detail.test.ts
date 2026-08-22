import { describe, expect, it } from "vitest";
import {
  AlertLevel,
  CheckKind,
  HouseholdStatus,
  RiskGrade,
  VisitResult,
  WorkerRole,
} from "../domain";
import { buildAdminWorkerDetail } from "./worker-detail";

describe("관리자 생활지원사 상세", () => {
  it("당일 대상자 현황과 활동을 생활지원사 단위로 요약한다", () => {
    const detail = buildAdminWorkerDetail({
      date: "2026-08-22",
      worker: {
        id: "worker-1",
        name: "박○○",
        phone: "010-1234-5678",
        role: WorkerRole.WORKER,
        subjects: [
          {
            id: "subject-1",
            name: "김○○",
            phone: "010-0000-0101",
            birthYear: 1938,
            livesAlone: true,
            hasAircon: false,
            airconBroken: false,
            building: {
              id: "building-1",
              address: "경상북도 봉화군 춘양면 도심리 7",
              roadAddress: null,
              lat: 36.9,
              lng: 128.9,
              builtYear: 1972,
              isDetached: true,
              structure: "슬레이트",
            },
            assessments: [{
              score: 32,
              grade: RiskGrade.CRITICAL,
              reasons: JSON.stringify(["1938년생·독거", "오늘 체감 38도"]),
              alertDay: {
                level: AlertLevel.EMERGENCY,
                feelsLikeMax: 38.4,
              },
            }],
            dayStatuses: [{
              status: HouseholdStatus.VISIT_QUEUED,
              updatedAt: new Date("2026-08-22T05:10:00.000Z"),
            }],
          },
          {
            id: "subject-2",
            name: "이○○",
            phone: "010-0000-0102",
            birthYear: 1940,
            livesAlone: true,
            hasAircon: true,
            airconBroken: false,
            building: {
              id: "building-2",
              address: "경상북도 봉화군 춘양면 의양리 45-3",
              roadAddress: null,
              lat: 36.91,
              lng: 128.91,
              builtYear: 1968,
              isDetached: true,
              structure: "기와",
            },
            assessments: [{
              score: 21,
              grade: RiskGrade.HIGH,
              reasons: JSON.stringify(["1940년생·독거"]),
              alertDay: {
                level: AlertLevel.EMERGENCY,
                feelsLikeMax: 38.4,
              },
            }],
            dayStatuses: [{
              status: HouseholdStatus.RESOLVED,
              updatedAt: new Date("2026-08-22T04:45:00.000Z"),
            }],
          },
        ],
        checkEvents: [{
          id: "check-1",
          kind: CheckKind.VISIT,
          result: VisitResult.ACTED,
          memo: null,
          createdAt: new Date("2026-08-22T05:10:00.000Z"),
          alertDay: { date: "2026-08-22" },
          subject: { id: "subject-1", name: "김○○" },
        }],
      },
    });

    expect(detail?.region).toBe("봉화군 춘양면");
    expect(detail?.organization).toBe("춘양면 행정복지센터");
    expect(detail?.feelsLikeMax).toBe(38.4);
    expect(detail?.summary).toEqual({
      openCritical: 1,
      visitQueued: 1,
      completed: 1,
      coolingNeeded: 1,
    });
    expect(detail?.subjects[0]).toMatchObject({
      id: "subject-1",
      grade: RiskGrade.CRITICAL,
      status: HouseholdStatus.VISIT_QUEUED,
      reasons: ["1938년생·독거", "오늘 체감 38도"],
    });
    expect(detail?.activities[0]).toMatchObject({
      subjectName: "김○○",
      label: "방문 조치함",
      time: "14:10",
    });
  });

  it("생활지원사 역할이 아니면 상세를 만들지 않는다", () => {
    expect(buildAdminWorkerDetail({
      date: "2026-08-22",
      worker: {
        id: "manager-1",
        name: "관리자",
        phone: null,
        role: WorkerRole.MANAGER,
        subjects: [],
        checkEvents: [],
      },
    })).toBeNull();
  });

  it("광역시 도로명 주소를 도로명이 아닌 행정구역으로 요약한다", () => {
    const detail = buildAdminWorkerDetail({
      date: "2026-08-22",
      worker: {
        id: "worker-1",
        name: "이미경",
        phone: null,
        role: WorkerRole.WORKER,
        subjects: [{
          id: "subject-1",
          name: "김○○",
          phone: null,
          birthYear: 1938,
          livesAlone: true,
          hasAircon: true,
          airconBroken: false,
          building: {
            id: "building-1",
            address: "대구광역시 서구 비산동 1",
            roadAddress: "대구광역시 서구 북비산로 394-7",
            lat: 35.8,
            lng: 128.5,
            builtYear: 1972,
            isDetached: true,
            structure: null,
          },
          assessments: [],
          dayStatuses: [],
        }],
        checkEvents: [],
      },
    });

    expect(detail?.region).toBe("대구광역시 서구");
    expect(detail?.organization).toBe("서구 행정복지센터");
  });
});
