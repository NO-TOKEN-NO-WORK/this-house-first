import { describe, expect, it } from "vitest";
import { RiskGrade } from "../domain";
import type { VisitRoute, VisitRouteStop } from "../map/route";
import { withKakaoWalkingRoute } from "./walking-route";

function stop(index: number): VisitRouteStop {
  return {
    subjectId: `subject-${index}`,
    name: `합성 대상자 ${index}`,
    age: 80,
    livesAlone: true,
    address: `대구광역시 서구 비산동 ${index + 1}`,
    lat: 35.8 + index * 0.001,
    lng: 128.5 + index * 0.001,
    grade: RiskGrade.CRITICAL,
    score: 30 - index,
    reasons: [`대상자 ${index} 위험 사유`],
    minutesFromPrevious: index === 0 ? 0 : 2,
    metersFromPrevious: index === 0 ? 0 : 100,
  };
}

function estimatedRoute(count: number): VisitRoute {
  const stops = Array.from({ length: count }, (_, index) => stop(index));
  return {
    stops,
    totalMinutes: Math.max(0, count - 1) * 2,
    totalMeters: Math.max(0, count - 1) * 100,
    path: stops.map(({ lat, lng }) => ({ lat, lng })),
    source: "estimate",
  };
}

function response(legCount: number): Response {
  return Response.json({
    status: "OK",
    route: {
      legs: Array.from({ length: legCount }, (_, index) => ({
        properties: { distance: 150 + index, time: 120 + index * 60 },
        steps: [
          {
            path: {
              points: [
                [128.5 + index * 0.001, 35.8 + index * 0.001],
                [128.501 + index * 0.001, 35.801 + index * 0.001],
              ],
            },
          },
        ],
      })),
    },
  });
}

describe("withKakaoWalkingRoute", () => {
  it("카카오 도보 구간의 실제 시간·거리·경로 좌표로 예상치를 교체한다", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return response(1);
    };

    const route = await withKakaoWalkingRoute(estimatedRoute(2), {
      apiKey: "rest-key",
      fetcher: fetcher as typeof fetch,
    });

    const [{ input, init }] = requests;
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe("https://dapi.kakao.com/v2/routing/walk");
    expect(url.searchParams.get("route_mode")).toBe("SHORTEST");
    expect(url.searchParams.get("start_x")).toBe("128.5");
    expect(url.searchParams.get("end_x")).toBe("128.501");
    expect(init?.headers).toEqual({ Authorization: "KakaoAK rest-key" });
    expect(route).toMatchObject({
      source: "kakao",
      totalMinutes: 2,
      totalMeters: 150,
    });
    expect(route.stops[1]).toMatchObject({
      minutesFromPrevious: 2,
      metersFromPrevious: 150,
    });
    expect(route.path).toEqual([
      { lng: 128.5, lat: 35.8 },
      { lng: 128.501, lat: 35.801 },
    ]);
  });

  it("7곳을 넘는 방문지는 끝 지점을 겹쳐 여러 요청으로 이어 붙인다", async () => {
    const requests: Array<RequestInfo | URL> = [];
    const fetcher = async (input: RequestInfo | URL) => {
      requests.push(input);
      return response(requests.length === 1 ? 6 : 1);
    };

    const route = await withKakaoWalkingRoute(estimatedRoute(8), {
      apiKey: "rest-key",
      fetcher: fetcher as typeof fetch,
    });

    expect(requests).toHaveLength(2);
    const firstUrl = new URL(String(requests[0]));
    const secondUrl = new URL(String(requests[1]));
    expect(firstUrl.searchParams.get("via_x")?.split(",")).toHaveLength(5);
    expect(secondUrl.searchParams.get("start_x")).toBe(String(stop(6).lng));
    expect(secondUrl.searchParams.get("end_x")).toBe(String(stop(7).lng));
    expect(route.stops).toHaveLength(8);
    expect(route.source).toBe("kakao");
  });

  it("연속 방문지가 같은 좌표면 이동시간을 0분으로 유지한다", async () => {
    const route = estimatedRoute(2);
    route.stops[1] = { ...route.stops[1], lat: route.stops[0].lat, lng: route.stops[0].lng };
    let called = false;
    const fetcher = async () => {
      called = true;
      return response(1);
    };

    const resolved = await withKakaoWalkingRoute(route, {
      apiKey: "rest-key",
      fetcher: fetcher as typeof fetch,
    });

    expect(called).toBe(false);
    expect(resolved).toMatchObject({
      source: "kakao",
      totalMinutes: 0,
      totalMeters: 0,
    });
  });
});
