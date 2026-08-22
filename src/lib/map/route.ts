import type { AlertedBoard, Board, BoardSubject } from "../board/today";
import { HouseholdStatus, type RiskGrade } from "../domain";

/** 방문 동선 카드 한 장 — 위험 사유는 스코어링 엔진 원문을 그대로 보존한다. */
export interface VisitRouteStop {
  subjectId: string;
  name: string;
  age: number;
  livesAlone: boolean;
  address: string;
  lat: number;
  lng: number;
  grade: RiskGrade;
  score: number;
  reasons: string[];
  /** 바로 전 방문지에서 이 가구까지의 예상 차량 이동시간. 첫 가구는 0이다. */
  minutesFromPrevious: number;
  /** 바로 전 방문지에서 이 가구까지의 예상 차량 이동거리(m). 첫 가구는 0이다. */
  metersFromPrevious: number;
}

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface VisitRoute {
  stops: VisitRouteStop[];
  totalMinutes: number;
  totalMeters: number;
  /** 지도에 순서대로 그릴 경로. 카카오 응답 전에는 가구 좌표를 직선으로 잇는다. */
  path: RouteCoordinate[];
  source: "estimate" | "kakao-driving";
}

const EARTH_RADIUS_METERS = 6_371_000;
/**
 * 카카오 응답 전·실패 시 쓰는 차량 예상치. 도보 기준이던 75m/분·1.25배를 차량 실측값으로 대체했다 (ADR-0018).
 *
 * 출처 — 2026-08-22 대구 서구 비산동·평리동 좌표로 카카오모빌리티 길찾기(`priority: DISTANCE`) 실호출:
 * 도로거리 / 직선거리 = 1.43~1.70(15개 구간 합계 1.59, 별도 15가구 표본 1.61) → 1.6,
 * 평균 속도 14.3~21.3km/h(합계 19.1km/h) → 319m/분.
 * 도보값을 그대로 두면 예상 이동시간이 실제보다 약 28% 짧게 나온다.
 */
const DRIVING_METERS_PER_MINUTE = 319;
const STREET_DISTANCE_FACTOR = 1.6;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(
  from: Pick<BoardSubject, "lat" | "lng">,
  to: Pick<BoardSubject, "lat" | "lng">,
): number {
  const deltaLat = radians(to.lat - from.lat);
  const deltaLng = radians(to.lng - from.lng);
  const fromLat = radians(from.lat);
  const toLat = radians(to.lat);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function estimatedDrivingMinutes(from: BoardSubject, to: BoardSubject): number {
  const meters = distanceMeters(from, to) * STREET_DISTANCE_FACTOR;
  return meters === 0
    ? 0
    : Math.max(1, Math.round(meters / DRIVING_METERS_PER_MINUTE));
}

function estimatedDrivingMeters(from: BoardSubject, to: BoardSubject): number {
  return Math.round(distanceMeters(from, to) * STREET_DISTANCE_FACTOR);
}

function isVisitStop(subject: BoardSubject): boolean {
  return (
    subject.status === HouseholdStatus.VISIT_QUEUED ||
    subject.status === HouseholdStatus.VISITING
  );
}

function compareRisk(left: BoardSubject, right: BoardSubject): number {
  return (
    left.grade - right.grade ||
    right.score - left.score ||
    left.subjectId.localeCompare(right.subjectId)
  );
}

/**
 * FR-7 v0 동선: 등급을 먼저 지키고, 같은 등급 안에서는 바로 전 방문지와 가까운 가구를 고른다.
 * 출발 위치가 없으므로 첫 가구만 같은 등급 중 점수가 가장 높은 가구다.
 */
function orderVisitSubjects(board: AlertedBoard): BoardSubject[] {
  const candidates = board.groups
    .flatMap((group) => group.subjects)
    .filter(isVisitStop)
    .sort(compareRisk);
  const ordered: BoardSubject[] = [];

  while (candidates.length > 0) {
    const previous = ordered.at(-1);
    const highestGrade = candidates[0].grade;
    const sameGrade = candidates.filter((subject) => subject.grade === highestGrade);
    const next = previous
      ? sameGrade.sort(
          (left, right) =>
            distanceMeters(previous, left) - distanceMeters(previous, right) ||
            compareRisk(left, right),
        )[0]
      : sameGrade[0];

    ordered.push(next);
    candidates.splice(candidates.indexOf(next), 1);
  }

  return ordered;
}

export function toVisitRoute(board: Board): VisitRoute {
  if (!board.alerted) {
    return {
      stops: [],
      totalMinutes: 0,
      totalMeters: 0,
      path: [],
      source: "estimate",
    };
  }

  let totalMinutes = 0;
  let totalMeters = 0;
  const ordered = orderVisitSubjects(board);
  const stops = ordered.map((subject, index): VisitRouteStop => {
    const previous = ordered[index - 1];
    const minutesFromPrevious = previous
      ? estimatedDrivingMinutes(previous, subject)
      : 0;
    const metersFromPrevious = previous
      ? estimatedDrivingMeters(previous, subject)
      : 0;
    totalMinutes += minutesFromPrevious;
    totalMeters += metersFromPrevious;

    return {
      subjectId: subject.subjectId,
      name: subject.name,
      age: subject.age,
      livesAlone: subject.livesAlone,
      address: subject.roadAddress ?? subject.address,
      lat: subject.lat,
      lng: subject.lng,
      grade: subject.grade,
      score: subject.score,
      reasons: subject.reasons,
      minutesFromPrevious,
      metersFromPrevious,
    };
  });

  return {
    stops,
    totalMinutes,
    totalMeters,
    path: stops.map(({ lat, lng }) => ({ lat, lng })),
    source: "estimate",
  };
}

/** 카카오맵 공식 목적지 길찾기 URL. 현재 위치는 카카오맵이 출발지로 받는다. */
export function kakaoDirectionsHref(stop: VisitRouteStop): string {
  const label = encodeURIComponent(`${stop.name} ${stop.address}`);
  return `https://map.kakao.com/link/to/${label},${stop.lat},${stop.lng}`;
}
