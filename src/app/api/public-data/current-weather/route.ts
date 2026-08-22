import {
  invalidParameter,
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

function weatherGrid(request: Request): { nx: number; ny: number } {
  const query = new URL(request.url).searchParams;
  const nx = query.get("nx");
  const ny = query.get("ny");
  if (nx === null && ny === null) {
    return {
      nx: gridCoordinate("KMA_GRID_NX"),
      ny: gridCoordinate("KMA_GRID_NY"),
    };
  }
  if (!nx || !ny || !/^\d{1,3}$/.test(nx) || !/^\d{1,3}$/.test(ny)) {
    throw invalidParameter("nx와 ny는 함께 1~3자리 정수로 보내야 합니다.");
  }
  const grid = { nx: Number(nx), ny: Number(ny) };
  if (grid.nx < 1 || grid.nx > 149 || grid.ny < 1 || grid.ny > 253) {
    throw invalidParameter("nx는 1~149, ny는 1~253 범위여야 합니다.");
  }
  return grid;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const weather = await getCurrentWeather(weatherGrid(request));
    return Response.json({ data: weather });
  } catch (error) {
    return toPublicDataErrorResponse(error);
  }
}
