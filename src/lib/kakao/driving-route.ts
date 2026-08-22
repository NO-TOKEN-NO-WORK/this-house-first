import type {
  RouteCoordinate,
  VisitRoute,
  VisitRouteStop,
} from "../map/route";

const DESTINATIONS_URL =
  "https://apis-navi.kakaomobility.com/v1/destinations/directions";
const WAYPOINTS_URL =
  "https://apis-navi.kakaomobility.com/v1/waypoints/directions";
const DESTINATION_RADIUS_METERS = 10_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_VISIT_STOPS = 15;
/** 로그에 붙일 카카오 오류 본문 최대 길이 */
const ERROR_BODY_MAX_CHARS = 200;

type Fetcher = typeof fetch;

interface KakaoDestinationRoute {
  result_code: number;
  result_msg?: string;
  key: string;
  summary?: {
    distance: number;
    duration: number;
  };
}

interface KakaoDestinationsResponse {
  routes?: KakaoDestinationRoute[];
}

interface KakaoRoad {
  vertexes: number[];
}

interface KakaoSection {
  distance: number;
  duration: number;
  roads: KakaoRoad[];
}

interface KakaoDrivingRoute {
  result_code: number;
  result_msg?: string;
  sections?: KakaoSection[];
}

interface KakaoDrivingResponse {
  routes?: KakaoDrivingRoute[];
}

interface RoutingStop {
  originalIndex: number;
  stop: VisitRouteStop;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function samePosition(left: VisitRouteStop, right: VisitRouteStop): boolean {
  return left.lat === right.lat && left.lng === right.lng;
}

function uniqueConsecutiveStops(stops: VisitRouteStop[]): RoutingStop[] {
  const result: RoutingStop[] = [];

  for (const [originalIndex, stop] of stops.entries()) {
    const previous = result.at(-1)?.stop;
    if (!previous || !samePosition(previous, stop)) {
      result.push({ originalIndex, stop });
    }
  }

  return result;
}

/**
 * 실패 응답을 로그에 남길 문구로 바꾼다.
 *
 * 상태 코드만으로는 키가 틀린 건지 권한 문제인지 못 가리므로 카카오가 준 본문까지 붙인다.
 * 단 카카오는 401 본문에 보낸 앱 키를 그대로 되돌려주므로(`wrong appKey(...) format`)
 * 반드시 가린다 — 안 가리면 서버 로그에 `KAKAO_REST_KEY`가 그대로 남는다.
 */
async function requestFailure(response: Response, apiKey: string): Promise<string> {
  let body = "";
  try {
    body = (await response.text()).trim();
  } catch {
    body = "";
  }
  if (!body) return `HTTP ${response.status}`;
  const masked = apiKey ? body.split(apiKey).join("***") : body;
  return `HTTP ${response.status} ${masked.slice(0, ERROR_BODY_MAX_CHARS)}`;
}

function kakaoHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `KakaoAK ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function destinationBody(origin: VisitRouteStop, stops: VisitRouteStop[]): string {
  return JSON.stringify({
    origin: { x: origin.lng, y: origin.lat },
    destinations: stops.map((stop, index) => ({
      key: String(index),
      x: stop.lng,
      y: stop.lat,
    })),
    radius: DESTINATION_RADIUS_METERS,
    priority: "DISTANCE",
  });
}

function parseDestinationDistances(payload: unknown, expectedCount: number): number[] {
  if (payload == null || typeof payload !== "object") {
    throw new Error("카카오 자동차 거리 응답 형식이 올바르지 않습니다.");
  }

  const response = payload as KakaoDestinationsResponse;
  if (!Array.isArray(response.routes)) {
    throw new Error("카카오 자동차 거리 응답에 경로가 없습니다.");
  }

  const distances = Array.from({ length: expectedCount }, () => Number.NaN);
  for (const route of response.routes) {
    const index = Number(route.key);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= expectedCount ||
      route.result_code !== 0 ||
      !isFiniteNonNegative(route.summary?.distance)
    ) {
      throw new Error(
        `카카오 자동차 거리를 찾지 못했습니다: ${route.result_msg ?? route.result_code}`,
      );
    }
    distances[index] = route.summary.distance;
  }

  if (distances.some((distance) => !isFiniteNonNegative(distance))) {
    throw new Error("카카오 자동차 거리 응답 수가 방문지와 일치하지 않습니다.");
  }

  return distances;
}

async function drivingDistanceMatrix(
  stops: VisitRouteStop[],
  apiKey: string,
  fetcher: Fetcher,
): Promise<number[][]> {
  return Promise.all(
    stops.map(async (origin, originIndex) => {
      const destinations = stops.filter(
        (stop, destinationIndex) =>
          destinationIndex !== originIndex && !samePosition(origin, stop),
      );
      const row = stops.map((stop, destinationIndex) =>
        destinationIndex === originIndex || samePosition(origin, stop)
          ? 0
          : Number.NaN,
      );
      if (destinations.length === 0) return row;

      const response = await fetcher(DESTINATIONS_URL, {
        method: "POST",
        headers: kakaoHeaders(apiKey),
        body: destinationBody(origin, destinations),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(
          `카카오 자동차 거리 요청에 실패했습니다: ${await requestFailure(response, apiKey)}`,
        );
      }

      const distances = parseDestinationDistances(
        await response.json(),
        destinations.length,
      );
      for (const [destinationIndex, destination] of destinations.entries()) {
        const stopIndex = stops.indexOf(destination);
        row[stopIndex] = distances[destinationIndex];
      }
      return row;
    }),
  );
}

interface RemainingRoute {
  distance: number;
  indices: number[];
}

/**
 * 첫 방문지는 최고 위험 점수 가구로 고정하고, 위험 단계 순서를 지키는 경로 중
 * 실제 차량 도로거리 합이 가장 짧은 방문 순서를 동적 계획법으로 찾는다.
 */
export function shortestRiskOrderedIndices(
  stops: VisitRouteStop[],
  distances: number[][],
): number[] {
  if (stops.length <= 1) return stops.map((_, index) => index);
  if (stops.length > MAX_VISIT_STOPS) {
    throw new Error(`자동차 방문 경로는 최대 ${MAX_VISIT_STOPS}가구까지 계산합니다.`);
  }
  if (
    distances.length !== stops.length ||
    distances.some(
      (row) =>
        row.length !== stops.length ||
        row.some((distance) => !isFiniteNonNegative(distance)),
    )
  ) {
    throw new Error("자동차 거리 행렬이 방문지 수와 일치하지 않습니다.");
  }

  const fullMask = (1 << stops.length) - 1;
  const memo = new Map<string, RemainingRoute>();

  function solve(mask: number, previousIndex: number): RemainingRoute {
    if (mask === fullMask) return { distance: 0, indices: [] };
    const key = `${mask}:${previousIndex}`;
    const cached = memo.get(key);
    if (cached) return cached;

    let nextGrade = Number.POSITIVE_INFINITY;
    for (const [index, stop] of stops.entries()) {
      if ((mask & (1 << index)) === 0) nextGrade = Math.min(nextGrade, stop.grade);
    }

    let best: RemainingRoute | null = null;
    for (const [index, stop] of stops.entries()) {
      if ((mask & (1 << index)) !== 0 || stop.grade !== nextGrade) continue;
      const remaining = solve(mask | (1 << index), index);
      const candidate: RemainingRoute = {
        distance: distances[previousIndex][index] + remaining.distance,
        indices: [index, ...remaining.indices],
      };
      if (!best || candidate.distance < best.distance) best = candidate;
    }

    if (!best) throw new Error("자동차 방문 순서를 계산하지 못했습니다.");
    memo.set(key, best);
    return best;
  }

  return [0, ...solve(1, 0).indices];
}

function waypointsBody(stops: RoutingStop[]): string {
  const origin = stops[0].stop;
  const destination = stops.at(-1)!.stop;
  return JSON.stringify({
    origin: { x: origin.lng, y: origin.lat },
    destination: { x: destination.lng, y: destination.lat },
    waypoints: stops.slice(1, -1).map(({ stop }) => ({
      x: stop.lng,
      y: stop.lat,
    })),
    priority: "DISTANCE",
    alternatives: false,
    road_details: false,
    summary: false,
  });
}

function parseSections(payload: unknown, expectedCount: number): KakaoSection[] {
  if (payload == null || typeof payload !== "object") {
    throw new Error("카카오 자동차 경로 응답 형식이 올바르지 않습니다.");
  }

  const response = payload as KakaoDrivingResponse;
  const route = response.routes?.[0];
  if (!route || route.result_code !== 0 || !Array.isArray(route.sections)) {
    throw new Error(
      `카카오 자동차 경로를 찾지 못했습니다: ${route?.result_msg ?? route?.result_code ?? "UNKNOWN"}`,
    );
  }
  if (route.sections.length !== expectedCount) {
    throw new Error("카카오 자동차 경로의 구간 수가 방문지와 일치하지 않습니다.");
  }

  for (const section of route.sections) {
    if (
      !isFiniteNonNegative(section?.distance) ||
      !isFiniteNonNegative(section?.duration) ||
      !Array.isArray(section.roads)
    ) {
      throw new Error("카카오 자동차 경로 구간 형식이 올바르지 않습니다.");
    }
  }
  return route.sections;
}

function sectionPath(section: KakaoSection): RouteCoordinate[] {
  const path: RouteCoordinate[] = [];
  for (const road of section.roads) {
    if (!Array.isArray(road?.vertexes)) continue;
    for (let index = 0; index + 1 < road.vertexes.length; index += 2) {
      const lng = road.vertexes[index];
      const lat = road.vertexes[index + 1];
      if (Number.isFinite(lat) && Number.isFinite(lng)) path.push({ lat, lng });
    }
  }
  return path;
}

function appendPath(target: RouteCoordinate[], points: RouteCoordinate[]): void {
  for (const point of points) {
    const previous = target.at(-1);
    if (!previous || previous.lat !== point.lat || previous.lng !== point.lng) {
      target.push(point);
    }
  }
}

/**
 * 서버 전용 카카오 자동차 최단 경로.
 * 위험 단계 우선 제약 안에서 방문 순서를 최적화하고 실제 도로 경로로 지도를 보강한다.
 */
export async function withKakaoDrivingRoute(
  route: VisitRoute,
  options: { apiKey?: string; fetcher?: Fetcher } = {},
): Promise<VisitRoute> {
  if (route.stops.length === 0) return route;

  const apiKey = options.apiKey ?? process.env.KAKAO_REST_KEY?.trim();
  if (!apiKey) throw new Error("KAKAO_REST_KEY가 설정되지 않았습니다.");
  if (route.stops.length > MAX_VISIT_STOPS) {
    throw new Error(`자동차 방문 경로는 최대 ${MAX_VISIT_STOPS}가구까지 계산합니다.`);
  }

  const fetcher = options.fetcher ?? fetch;
  const order =
    route.stops.length > 2
      ? shortestRiskOrderedIndices(
          route.stops,
          await drivingDistanceMatrix(route.stops, apiKey, fetcher),
        )
      : route.stops.map((_, index) => index);
  const orderedStops = order.map((index) => route.stops[index]);
  const routingStops = uniqueConsecutiveStops(orderedStops);
  const stops = orderedStops.map((stop) => ({
    ...stop,
    minutesFromPrevious: 0,
    metersFromPrevious: 0,
  }));
  const path: RouteCoordinate[] = [];
  let totalMinutes = 0;
  let totalMeters = 0;

  if (routingStops.length === 1) {
    const [{ stop }] = routingStops;
    return {
      ...route,
      stops,
      totalMinutes,
      totalMeters,
      path: [{ lat: stop.lat, lng: stop.lng }],
      source: "kakao-driving",
    };
  }

  const response = await fetcher(WAYPOINTS_URL, {
    method: "POST",
    headers: kakaoHeaders(apiKey),
    body: waypointsBody(routingStops),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `카카오 자동차 경로 요청에 실패했습니다: ${await requestFailure(response, apiKey)}`,
    );
  }

  const sections = parseSections(await response.json(), routingStops.length - 1);
  for (const [sectionIndex, section] of sections.entries()) {
    const origin = routingStops[sectionIndex];
    const destination = routingStops[sectionIndex + 1];
    const meters = Math.round(section.distance);
    const minutes =
      section.duration === 0 ? 0 : Math.max(1, Math.round(section.duration / 60));
    stops[destination.originalIndex] = {
      ...stops[destination.originalIndex],
      minutesFromPrevious: minutes,
      metersFromPrevious: meters,
    };
    totalMinutes += minutes;
    totalMeters += meters;

    const points = sectionPath(section);
    appendPath(
      path,
      points.length > 0
        ? points
        : [
            { lat: origin.stop.lat, lng: origin.stop.lng },
            { lat: destination.stop.lat, lng: destination.stop.lng },
          ],
    );
  }

  return {
    ...route,
    stops,
    totalMinutes,
    totalMeters,
    path,
    source: "kakao-driving",
  };
}
