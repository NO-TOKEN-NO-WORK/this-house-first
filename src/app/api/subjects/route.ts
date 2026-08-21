import { getBoard } from "@/lib/board/today";
import { optionalId, optionalIsoDate, toErrorResponse } from "@/lib/http";

/**
 * 담당자 대응 보드 데이터 (FR-4).
 *
 * `GET /api/subjects` — 오늘(KST)
 * `GET /api/subjects?date=2026-08-21&workerId=...`
 *
 * 비경보일에는 `{ alerted: false }`만 돌아온다 — 침묵이 스펙(PRD §9).
 * `/today` 화면과 같은 조회 함수를 쓴다.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams;
    const board = await getBoard({
      date: optionalIsoDate(query.get("date")),
      workerId: optionalId(query.get("workerId"), "workerId"),
    });
    return Response.json({ data: board });
  } catch (error) {
    return toErrorResponse(error);
  }
}
