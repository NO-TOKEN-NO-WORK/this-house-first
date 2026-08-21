import { fetchBuildingTitles } from "@/lib/bldg-hub/client";
import { toBuildingFacts } from "@/lib/bldg-hub/mapping";
import {
  invalidParameter,
  toPublicDataErrorResponse,
} from "@/lib/public-data/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredCode(
  value: string | null,
  name: string,
  digits: number,
): string {
  if (!value || !new RegExp(`^\\d{${digits}}$`).test(value)) {
    throw invalidParameter(`${name}는 ${digits}자리 숫자여야 합니다.`);
  }
  return value;
}

function lotNumber(value: string | null, name: string): string | undefined {
  if (value == null) return undefined;
  if (!/^\d{1,4}$/.test(value)) {
    throw invalidParameter(`${name}은 1~4자리 숫자여야 합니다.`);
  }
  return value.padStart(4, "0");
}

export async function GET(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams;
    const platGbCd = query.get("platGbCd") ?? undefined;
    if (platGbCd && !/^[012]$/.test(platGbCd)) {
      throw invalidParameter(
        "platGbCd는 0(대지), 1(산), 2(블록) 중 하나여야 합니다.",
      );
    }

    const page = await fetchBuildingTitles({
      sigunguCd: requiredCode(query.get("sigunguCd"), "sigunguCd", 5),
      bjdongCd: requiredCode(query.get("bjdongCd"), "bjdongCd", 5),
      platGbCd: platGbCd as "0" | "1" | "2" | undefined,
      bun: lotNumber(query.get("bun"), "bun"),
      ji: lotNumber(query.get("ji"), "ji"),
    });
    return Response.json({
      data: page.items.map(toBuildingFacts),
      source: "국토교통부 건축HUB 건축물대장정보 서비스",
      pagination: {
        page: page.pageNo,
        pageSize: page.numOfRows,
        totalCount: page.totalCount,
      },
    });
  } catch (error) {
    return toPublicDataErrorResponse(error);
  }
}
