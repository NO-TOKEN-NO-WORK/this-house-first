import {
  invalidParameter,
  toPublicDataErrorResponse,
} from "@/lib/public-data/client";
import { formatKstDate, getWeatherWarnings } from "@/lib/public-data/kma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateParameter(value: string | null, fallback: string): string {
  const result = value ?? fallback;
  if (!/^\d{8}$/.test(result)) {
    throw invalidParameter("fromDate와 toDate는 YYYYMMDD 형식이어야 합니다.");
  }
  return result;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams;
    const today = formatKstDate(new Date());
    const warnings = await getWeatherWarnings({
      fromDate: dateParameter(query.get("fromDate"), today),
      toDate: dateParameter(query.get("toDate"), today),
      stationId: query.get("stationId") ?? undefined,
    });
    return Response.json({
      data: warnings,
      source: "기상청 기상특보 조회서비스",
    });
  } catch (error) {
    return toPublicDataErrorResponse(error);
  }
}
