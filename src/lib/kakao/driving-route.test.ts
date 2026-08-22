import { describe, expect, it } from "vitest";
import { RiskGrade } from "../domain";
import type { VisitRoute, VisitRouteStop } from "../map/route";
import {
  shortestRiskOrderedIndices,
  withKakaoDrivingRoute,
} from "./driving-route";

function stop(
  index: number,
  grade: VisitRouteStop["grade"] = RiskGrade.CRITICAL,
): VisitRouteStop {
  return {
    subjectId: `subject-${index}`,
    name: `합성 대상자 ${index}`,
    age: 80,
    livesAlone: true,
    address: `대구광역시 서구 비산동 ${index + 1}`,
    lat: 35.8 + index * 0.001,
    lng: 128.5 + index * 0.001,
    grade,
    score: 30 - index,
    reasons: [`대상자 ${index} 위험 사유`],
    minutesFromPrevious: index === 0 ? 0 : 2,
    metersFromPrevious: index === 0 ? 0 : 100,
  };
}

function estimatedRoute(stops: VisitRouteStop[]): VisitRoute {
  return {
    stops,
    totalMinutes: Math.max(0, stops.length - 1) * 2,
    totalMeters: Math.max(0, stops.length - 1) * 100,
    path: stops.map(({ lat, lng }) => ({ lat, lng })),
    source: "estimate",
  };
}

function directionsResponse(stops: VisitRouteStop[]): Response {
  return Response.json({
    routes: [
      {
        result_code: 0,
        result_msg: "길찾기 성공",
        sections: stops.slice(1).map((destination, index) => ({
          distance: 150 + index,
          duration: 120 + index * 60,
          roads: [
            {
              vertexes: [
                stops[index].lng,
                stops[index].lat,
                destination.lng,
                destination.lat,
              ],
            },
          ],
        })),
      },
    ],
  });
}

describe("shortestRiskOrderedIndices", () => {
  it("첫 가구와 위험 단계 순서를 지키는 실제 도로거리 최단 순서를 찾는다", () => {
    const stops = [
      stop(0),
      stop(1),
      stop(2),
      stop(3, RiskGrade.HIGH),
    ];
    const distances = [
      [0, 9, 1, 1],
      [9, 0, 1, 1],
      [9, 1, 0, 9],
      [1, 1, 1, 0],
    ];

    expect(shortestRiskOrderedIndices(stops, distances)).toEqual([0, 2, 1, 3]);
  });

  it("더 짧아도 낮은 위험 단계 가구를 먼저 배치하지 않는다", () => {
    const stops = [stop(0), stop(1), stop(2, RiskGrade.HIGH)];
    const distances = [
      [0, 100, 1],
      [100, 0, 1],
      [1, 1, 0],
    ];

    expect(shortestRiskOrderedIndices(stops, distances)).toEqual([0, 1, 2]);
  });
});

describe("withKakaoDrivingRoute", () => {
  it("카카오 자동차 최단 구간의 시간·거리·도로 좌표로 예상치를 교체한다", async () => {
    const stops = [stop(0), stop(1)];
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return directionsResponse(stops);
    };

    const route = await withKakaoDrivingRoute(estimatedRoute(stops), {
      apiKey: "rest-key",
      fetcher: fetcher as typeof fetch,
    });

    const [{ input, init }] = requests;
    expect(String(input)).toBe(
      "https://apis-navi.kakaomobility.com/v1/waypoints/directions",
    );
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      Authorization: "KakaoAK rest-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      origin: { x: 128.5, y: 35.8 },
      destination: { x: 128.501, y: 35.800999999999995 },
      priority: "DISTANCE",
      summary: false,
    });
    expect(route).toMatchObject({
      source: "kakao-driving",
      totalMinutes: 2,
      totalMeters: 150,
    });
    expect(route.stops[1]).toMatchObject({
      minutesFromPrevious: 2,
      metersFromPrevious: 150,
    });
    expect(route.path).toEqual([
      { lng: 128.5, lat: 35.8 },
      { lng: 128.501, lat: 35.800999999999995 },
    ]);
  });

  it("다중 목적지 자동차 거리 행렬로 위험 단계 안의 방문 순서를 바꾼다", async () => {
    const stops = [stop(0), stop(1), stop(2)];
    const distances = [
      [0, 900, 100],
      [900, 0, 100],
      [900, 100, 0],
    ];
    const requests: string[] = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith("/destinations/directions")) {
        const body = JSON.parse(String(init?.body)) as {
          origin: { x: number };
          destinations: Array<{ key: string; x: number }>;
          priority: string;
        };
        const originIndex = stops.findIndex((item) => item.lng === body.origin.x);
        return Response.json({
          routes: body.destinations.map((destination) => {
            const destinationIndex = stops.findIndex(
              (item) => item.lng === destination.x,
            );
            return {
              result_code: 0,
              result_msg: "길찾기 성공",
              key: destination.key,
              summary: {
                distance: distances[originIndex][destinationIndex],
                duration: 60,
              },
            };
          }),
        });
      }

      const body = JSON.parse(String(init?.body)) as {
        origin: { x: number };
        destination: { x: number };
        waypoints: Array<{ x: number }>;
      };
      const orderedLngs = [
        body.origin.x,
        ...body.waypoints.map(({ x }) => x),
        body.destination.x,
      ];
      const orderedStops = orderedLngs.map(
        (lng) => stops.find((item) => item.lng === lng)!,
      );
      return directionsResponse(orderedStops);
    };

    const route = await withKakaoDrivingRoute(estimatedRoute(stops), {
      apiKey: "rest-key",
      fetcher: fetcher as typeof fetch,
    });

    expect(requests.filter((url) => url.endsWith("/destinations/directions"))).toHaveLength(3);
    expect(route.stops.map(({ subjectId }) => subjectId)).toEqual([
      "subject-0",
      "subject-2",
      "subject-1",
    ]);
    expect(route.source).toBe("kakao-driving");
  });

  it("실패 응답의 카카오 본문을 에러에 붙이되 앱 키는 가린다", async () => {
    // 카카오는 401 본문에 보낸 키를 그대로 되돌려준다 — 로그에 새면 안 된다
    const stops = [stop(0), stop(1)];
    const fetcher = async () =>
      new Response(
        JSON.stringify({ code: -401, msg: "wrong appKey(rest-key) format" }),
        { status: 401 },
      );

    const error = await withKakaoDrivingRoute(estimatedRoute(stops), {
      apiKey: "rest-key",
      fetcher: fetcher as typeof fetch,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("HTTP 401");
    expect(message).toContain("wrong appKey(***) format");
    expect(message).not.toContain("rest-key");
  });

  it("연속 방문지가 같은 좌표면 API 호출 없이 이동시간을 0분으로 유지한다", async () => {
    const stops = [stop(0), { ...stop(1), lat: stop(0).lat, lng: stop(0).lng }];
    let called = false;
    const fetcher = async () => {
      called = true;
      return directionsResponse(stops);
    };

    const route = await withKakaoDrivingRoute(estimatedRoute(stops), {
      apiKey: "rest-key",
      fetcher: fetcher as typeof fetch,
    });

    expect(called).toBe(false);
    expect(route).toMatchObject({
      source: "kakao-driving",
      totalMinutes: 0,
      totalMeters: 0,
    });
  });
});
