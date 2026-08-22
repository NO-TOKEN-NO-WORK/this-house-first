import type {
  RouteCoordinate,
  VisitRoute,
  VisitRouteStop,
} from "../map/route";

const WALKING_ROUTE_URL = "https://dapi.kakao.com/v2/routing/walk";
const MAX_POINTS_PER_REQUEST = 7;
const REQUEST_TIMEOUT_MS = 5_000;

type Fetcher = typeof fetch;

interface RoutingStop {
  originalIndex: number;
  stop: VisitRouteStop;
}

interface KakaoLeg {
  properties: { distance: number; time: number };
  steps: Array<{ path: { points: number[][] } }>;
}

interface KakaoWalkingResponse {
  status: string;
  route?: {
    legs: KakaoLeg[];
  };
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

function chunkStops(stops: RoutingStop[]): RoutingStop[][] {
  const chunks: RoutingStop[][] = [];
  for (let index = 0; index < stops.length - 1; index += MAX_POINTS_PER_REQUEST - 1) {
    chunks.push(stops.slice(index, index + MAX_POINTS_PER_REQUEST));
  }
  return chunks;
}

function walkingRouteUrl(stops: RoutingStop[]): URL {
  const start = stops[0].stop;
  const end = stops.at(-1)!.stop;
  const via = stops.slice(1, -1).map(({ stop }) => stop);
  const url = new URL(WALKING_ROUTE_URL);

  url.searchParams.set("start_x", String(start.lng));
  url.searchParams.set("start_y", String(start.lat));
  url.searchParams.set("end_x", String(end.lng));
  url.searchParams.set("end_y", String(end.lat));
  url.searchParams.set("route_mode", "SHORTEST");
  if (via.length > 0) {
    url.searchParams.set("via_x", via.map(({ lng }) => lng).join(","));
    url.searchParams.set("via_y", via.map(({ lat }) => lat).join(","));
  }

  return url;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseLegs(payload: unknown, expectedCount: number): KakaoLeg[] {
  if (payload == null || typeof payload !== "object") {
    throw new Error("카카오 도보 경로 응답 형식이 올바르지 않습니다.");
  }
  const response = payload as KakaoWalkingResponse;
  if (response.status !== "OK" || !response.route) {
    throw new Error(`카카오 도보 경로를 찾지 못했습니다: ${response.status || "UNKNOWN"}`);
  }
  if (!Array.isArray(response.route.legs) || response.route.legs.length !== expectedCount) {
    throw new Error("카카오 도보 경로의 구간 수가 방문지와 일치하지 않습니다.");
  }

  for (const leg of response.route.legs) {
    if (
      !isFiniteNonNegative(leg?.properties?.distance) ||
      !isFiniteNonNegative(leg?.properties?.time) ||
      !Array.isArray(leg.steps)
    ) {
      throw new Error("카카오 도보 경로 구간 형식이 올바르지 않습니다.");
    }
  }
  return response.route.legs;
}

function legPath(leg: KakaoLeg): RouteCoordinate[] {
  const path: RouteCoordinate[] = [];
  for (const step of leg.steps) {
    if (!Array.isArray(step?.path?.points)) continue;
    for (const point of step.path.points) {
      const [lng, lat] = point;
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
 * 서버 전용 카카오 도보 경로 보강.
 * 위험 단계 우선 순서는 순수 함수 `toVisitRoute`가 정하고, 이 함수는 그 순서를 바꾸지 않는다.
 */
export async function withKakaoWalkingRoute(
  route: VisitRoute,
  options: { apiKey?: string; fetcher?: Fetcher } = {},
): Promise<VisitRoute> {
  if (route.stops.length === 0) return route;

  const apiKey = options.apiKey ?? process.env.KAKAO_REST_KEY?.trim();
  if (!apiKey) throw new Error("KAKAO_REST_KEY가 설정되지 않았습니다.");

  const routingStops = uniqueConsecutiveStops(route.stops);
  const stops = route.stops.map((stop) => ({
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
      source: "kakao",
    };
  }

  const fetcher = options.fetcher ?? fetch;
  for (const chunk of chunkStops(routingStops)) {
    const response = await fetcher(walkingRouteUrl(chunk), {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`카카오 도보 경로 요청에 실패했습니다: HTTP ${response.status}`);
    }

    const legs = parseLegs(await response.json(), chunk.length - 1);
    for (const [legIndex, leg] of legs.entries()) {
      const destination = chunk[legIndex + 1];
      const meters = Math.round(leg.properties.distance);
      const minutes = meters === 0 ? 0 : Math.max(1, Math.round(leg.properties.time / 60));
      stops[destination.originalIndex] = {
        ...stops[destination.originalIndex],
        minutesFromPrevious: minutes,
        metersFromPrevious: meters,
      };
      totalMinutes += minutes;
      totalMeters += meters;

      const points = legPath(leg);
      if (points.length > 0) appendPath(path, points);
      else {
        appendPath(path, [
          { lat: chunk[legIndex].stop.lat, lng: chunk[legIndex].stop.lng },
          { lat: destination.stop.lat, lng: destination.stop.lng },
        ]);
      }
    }
  }

  return {
    ...route,
    stops,
    totalMinutes,
    totalMeters,
    path,
    source: "kakao",
  };
}
