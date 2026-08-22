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
  /** 바로 전 방문지에서 이 가구까지의 예상 도보 시간. 첫 가구는 0이다. */
  minutesFromPrevious: number;
}

export interface VisitRoute {
  stops: VisitRouteStop[];
  totalMinutes: number;
}

const EARTH_RADIUS_METERS = 6_371_000;
/** 잠정 — 실제 도보 경로 API 연동 전, 직선거리의 1.25배를 분당 75m로 걷는다고 본다. */
const WALKING_METERS_PER_MINUTE = 75;
const STREET_DISTANCE_FACTOR = 1.25;

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

function walkingMinutes(from: BoardSubject, to: BoardSubject): number {
  return Math.round(
    (distanceMeters(from, to) * STREET_DISTANCE_FACTOR) /
      WALKING_METERS_PER_MINUTE,
  );
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
  if (!board.alerted) return { stops: [], totalMinutes: 0 };

  let totalMinutes = 0;
  const ordered = orderVisitSubjects(board);
  const stops = ordered.map((subject, index): VisitRouteStop => {
    const previous = ordered[index - 1];
    const minutesFromPrevious = previous ? walkingMinutes(previous, subject) : 0;
    totalMinutes += minutesFromPrevious;

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
    };
  });

  return { stops, totalMinutes };
}

/** 카카오맵 공식 목적지 길찾기 URL. 현재 위치는 카카오맵이 출발지로 받는다. */
export function kakaoDirectionsHref(stop: VisitRouteStop): string {
  const label = encodeURIComponent(`${stop.name} ${stop.address}`);
  return `https://map.kakao.com/link/to/${label},${stop.lat},${stop.lng}`;
}
