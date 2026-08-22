import { describe, expect, it } from "vitest";
import type { AlertedBoard, BoardSubject, SilentBoard } from "../board/today";
import { AlertLevel, CheckKind, HouseholdStatus, RiskGrade } from "../domain";
import { kakaoDirectionsHref, toVisitRoute } from "./route";

function subject(
  subjectId: string,
  options: Partial<BoardSubject> = {},
): BoardSubject {
  return {
    subjectId,
    buildingId: `building-${subjectId}`,
    name: `합성 대상자 ${subjectId}`,
    age: 80,
    birthYear: 1946,
    livesAlone: true,
    phone: "010-0000-0000",
    address: "대구광역시 서구 비산동 1",
    roadAddress: null,
    lat: 35.8,
    lng: 128.5,
    grade: RiskGrade.CRITICAL,
    score: 30,
    reasons: [`${subjectId} 위험 사유`],
    status: HouseholdStatus.VISIT_QUEUED,
    statusLabel: "방문 대기",
    callAttempts: 0,
    open: true,
    nextCheckKind: CheckKind.VISIT,
    lastResult: null,
    lastCheckKind: null,
    lastCheckAtLabel: null,
    ...options,
  };
}

function alertedBoard(subjects: BoardSubject[]): AlertedBoard {
  return {
    alerted: true,
    isDemo: false,
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
        subjects,
      },
    ],
    summary: {
      total: subjects.length,
      open: subjects.length,
      openCritical: subjects.length,
      visitQueued: subjects.length,
      openByGrade: { 1: subjects.length, 2: 0, 3: 0 },
    },
  };
}

describe("toVisitRoute", () => {
  it("방문 대기·방문 중 가구만 위험도 우선, 같은 등급은 가까운 순서로 잇는다", () => {
    const first = subject("first", { score: 40, lat: 35.8, lng: 128.5 });
    const near = subject("near", {
      score: 20,
      lat: 35.8005,
      lng: 128.5,
      status: HouseholdStatus.VISITING,
      statusLabel: "방문 중",
    });
    const far = subject("far", { score: 30, lat: 35.82, lng: 128.5 });
    const callOnly = subject("call", {
      grade: RiskGrade.HIGH,
      status: HouseholdStatus.UNCHECKED,
      statusLabel: "미확인",
      nextCheckKind: CheckKind.CALL,
    });

    const route = toVisitRoute(alertedBoard([far, callOnly, near, first]));

    expect(route.stops.map((stop) => stop.subjectId)).toEqual([
      "first",
      "near",
      "far",
    ]);
    expect(route.stops[1].minutesFromPrevious).toBeGreaterThan(0);
    expect(route.totalMinutes).toBe(
      route.stops.reduce((sum, stop) => sum + stop.minutesFromPrevious, 0),
    );
    expect(route.totalMeters).toBe(
      route.stops.reduce((sum, stop) => sum + stop.metersFromPrevious, 0),
    );
    expect(route.path).toHaveLength(3);
    expect(route.source).toBe("estimate");
  });

  it("이동거리가 짧아도 더 위험한 단계를 먼저 방문한다", () => {
    const critical = subject("critical", {
      grade: RiskGrade.CRITICAL,
      score: 30,
      lat: 35.82,
    });
    const high = subject("high", {
      grade: RiskGrade.HIGH,
      score: 100,
      lat: 35.8001,
    });
    const moderate = subject("moderate", {
      grade: RiskGrade.MODERATE,
      score: 200,
      lat: 35.80005,
    });

    const route = toVisitRoute(alertedBoard([moderate, high, critical]));

    expect(route.stops.map((stop) => stop.subjectId)).toEqual([
      "critical",
      "high",
      "moderate",
    ]);
  });

  it("폴백 예상치는 도보가 아니라 실측한 차량 값으로 계산한다", () => {
    // 직선 약 1km 떨어진 두 가구 — 실측 도로 배율 1.6배·319m/분 (ADR-0018)
    const from = subject("from", { score: 40, lat: 35.8, lng: 128.5 });
    const to = subject("to", { score: 30, lat: 35.809, lng: 128.5 });

    const [, second] = toVisitRoute(alertedBoard([from, to])).stops;

    expect(second.metersFromPrevious).toBe(1601);
    expect(second.minutesFromPrevious).toBe(5);
  });

  it("도로명 주소와 스코어링 사유 원문을 보존한다", () => {
    const route = toVisitRoute(
      alertedBoard([
        subject("one", {
          roadAddress: "대구광역시 서구 달서로 1",
          reasons: ["1938년생 (88세)·독거", "오늘 비상 단계 (체감 38도)"],
        }),
      ]),
    );

    expect(route.stops[0]).toMatchObject({
      address: "대구광역시 서구 달서로 1",
      reasons: ["1938년생 (88세)·독거", "오늘 비상 단계 (체감 38도)"],
    });
  });

  it("비경보일에는 방문 순서와 예상 시간을 만들지 않는다", () => {
    const board: SilentBoard = {
      alerted: false,
      date: "2026-08-22",
      dateLabel: "8월 22일(토)",
      worker: { id: "worker-1", name: "담당자" },
      dong: "비산동",
      subjects: [],
    };

    expect(toVisitRoute(board)).toEqual({
      stops: [],
      totalMinutes: 0,
      totalMeters: 0,
      path: [],
      source: "estimate",
    });
  });

  it("카카오맵 목적지 길찾기 URL에 합성 이름·주소·좌표를 넣는다", () => {
    const [stop] = toVisitRoute(alertedBoard([subject("one")])).stops;

    expect(kakaoDirectionsHref(stop)).toBe(
      "https://map.kakao.com/link/to/%ED%95%A9%EC%84%B1%20%EB%8C%80%EC%83%81%EC%9E%90%20one%20%EB%8C%80%EA%B5%AC%EA%B4%91%EC%97%AD%EC%8B%9C%20%EC%84%9C%EA%B5%AC%20%EB%B9%84%EC%82%B0%EB%8F%99%201,35.8,128.5",
    );
  });
});
