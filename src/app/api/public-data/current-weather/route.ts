import {
  PublicDataError,
  toPublicDataErrorResponse,
} from "@/lib/public-data/client";
import { getCurrentWeather } from "@/lib/public-data/kma";

export const runtime = "nodejs";

function gridCoordinate(name: "KMA_GRID_NX" | "KMA_GRID_NY"): number {
  const value = process.env[name];
  if (!value || !/^\d{1,3}$/.test(value)) {
    throw new PublicDataError(
      `${name} 환경변수가 1~3자리 정수로 설정되지 않았습니다.`,
      "MISSING_WEATHER_GRID",
      503,
    );
  }
  return Number(value);
}

export async function GET(_request: Request): Promise<Response> {
  void _request;
  try {
    const weather = await getCurrentWeather({
      nx: gridCoordinate("KMA_GRID_NX"),
      ny: gridCoordinate("KMA_GRID_NY"),
    });
    return Response.json({ data: weather });
  } catch (error) {
    return toPublicDataErrorResponse(error);
  }
}
