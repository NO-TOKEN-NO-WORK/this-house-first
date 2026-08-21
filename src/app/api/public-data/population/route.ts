import {
  invalidParameter,
  toPublicDataErrorResponse,
} from "@/lib/public-data/client";
import { getAgePopulation } from "@/lib/public-data/population";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function yearMonth(value: string | null, name: string): string {
  if (!value || !/^\d{4}(0[1-9]|1[0-2])$/.test(value)) {
    throw invalidParameter(`${name}는 YYYYMM 형식이어야 합니다.`);
  }
  return value;
}

function monthIndex(value: string): number {
  return Number(value.slice(0, 4)) * 12 + Number(value.slice(4, 6)) - 1;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams;
    const administrationCode = query.get("administrationCode");
    if (!administrationCode || !/^\d{10}$/.test(administrationCode)) {
      throw invalidParameter(
        "administrationCode는 10자리 행정기관코드여야 합니다.",
      );
    }
    const level = query.get("level") ?? "7";
    if (!/^[1-7]$/.test(level)) {
      throw invalidParameter("level은 1~7 중 하나여야 합니다.");
    }
    const registrationType = query.get("registrationType") ?? "1";
    if (!/^[1-4]$/.test(registrationType)) {
      throw invalidParameter("registrationType은 1~4 중 하나여야 합니다.");
    }
    const fromYearMonth = yearMonth(
      query.get("fromYearMonth"),
      "fromYearMonth",
    );
    const toYearMonth = yearMonth(
      query.get("toYearMonth") ?? fromYearMonth,
      "toYearMonth",
    );
    const rangeInMonths = monthIndex(toYearMonth) - monthIndex(fromYearMonth);
    if (rangeInMonths < 0 || rangeInMonths > 2) {
      throw invalidParameter(
        "조회 기간은 시작월부터 종료월까지 최대 3개월이어야 합니다.",
      );
    }

    const population = await getAgePopulation({
      administrationCode,
      fromYearMonth,
      toYearMonth,
      level,
      registrationType,
    });
    return Response.json({
      data: population,
      source: "행정안전부 행정동별 성·연령별 주민등록 인구수",
      note: "원 API가 10세 구간을 제공하므로 65세 이상이 아닌 70세 이상 비율을 반환합니다.",
    });
  } catch (error) {
    return toPublicDataErrorResponse(error);
  }
}
