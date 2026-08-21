import {
  invalidParameter,
  toPublicDataErrorResponse,
} from "@/lib/public-data/client";
import { getHeatForecast } from "@/lib/public-data/kma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gridCoordinate(value: string | null, name: string): number {
  if (!value || !/^\d{1,3}$/.test(value)) {
    throw invalidParameter(`${name}는 1~3자리 기상청 격자좌표여야 합니다.`);
  }
  return Number(value);
}

function optionalDate(value: string | null, name: string): string | undefined {
  if (value == null) return undefined;
  if (!/^\d{8}$/.test(value)) {
    throw invalidParameter(`${name}는 YYYYMMDD 형식이어야 합니다.`);
  }
  return value;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams;
    const baseDate = optionalDate(query.get("baseDate"), "baseDate");
    const baseTime = query.get("baseTime") ?? undefined;
    if (baseTime && !/^(02|05|08|11|14|17|20|23)00$/.test(baseTime)) {
      throw invalidParameter("baseTime은 단기예보 발표시각(HH00)이어야 합니다.");
    }
    if ((baseDate == null) !== (baseTime == null)) {
      throw invalidParameter("baseDate와 baseTime은 함께 지정해야 합니다.");
    }

    const forecast = await getHeatForecast({
      nx: gridCoordinate(query.get("nx"), "nx"),
      ny: gridCoordinate(query.get("ny"), "ny"),
      targetDate: optionalDate(query.get("targetDate"), "targetDate"),
      baseDate,
      baseTime,
    });
    return Response.json({ data: forecast });
  } catch (error) {
    return toPublicDataErrorResponse(error);
  }
}
