import { getBoard } from "@/lib/board/today";
import { optionalId, optionalIsoDate, toErrorResponse } from "@/lib/http";
import { withKakaoDrivingRoute } from "@/lib/kakao/driving-route";
import { toVisitRoute } from "@/lib/map/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 담당자 방문 큐를 위험 단계 우선으로 정렬하고 카카오 자동차 최단 경로로 보강한다. */
export async function GET(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams;
    const board = await getBoard({
      date: optionalIsoDate(query.get("date")),
      workerId: optionalId(query.get("workerId"), "workerId"),
    });
    const fallbackRoute = toVisitRoute(board);
    const apiKey = process.env.KAKAO_REST_KEY?.trim();

    if (!apiKey || fallbackRoute.stops.length === 0) {
      return Response.json({ data: fallbackRoute });
    }

    try {
      const route = await withKakaoDrivingRoute(fallbackRoute, { apiKey });
      return Response.json({ data: route });
    } catch (error) {
      console.warn("카카오 자동차 경로를 불러오지 못해 거리 추정치를 사용합니다.", error);
      return Response.json({ data: fallbackRoute });
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
