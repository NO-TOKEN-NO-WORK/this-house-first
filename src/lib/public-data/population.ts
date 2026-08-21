import {
  fetchPublicDataJson,
  PublicDataError,
  type PublicDataFetch,
  requirePublicDataServiceKey,
} from "./client";

const POPULATION_URL =
  "https://apis.data.go.kr/1741000/admmSexdAgePpltn/selectAdmmSexdAgePpltn";

interface PopulationItem {
  statsYm: string;
  admmCd: string;
  ctpvNm: string;
  sggNm?: string;
  dongNm?: string;
  tong?: string;
  ban?: string;
  totNmprCnt: string;
  male60AgeNmprCnt: string;
  feml60AgeNmprCnt: string;
  male70AgeNmprCnt: string;
  feml70AgeNmprCnt: string;
  male80AgeNmprCnt: string;
  feml80AgeNmprCnt: string;
  male90AgeNmprCnt: string;
  feml90AgeNmprCnt: string;
  male100AgeNmprCnt: string;
  feml100AgeNmprCnt: string;
}

interface PopulationEnvelopeBody {
  head?: { resultCode: string; resultMsg: string };
  items?: { item?: PopulationItem | PopulationItem[] } | string;
}

interface PopulationEnvelope extends PopulationEnvelopeBody {
  /** 실제 운영 응답은 공식 Swagger와 달리 대문자 Response를 사용한다. */
  Response?: PopulationEnvelopeBody;
  response?: PopulationEnvelopeBody;
}

export interface PopulationRecord {
  statisticsMonth: string;
  administrationCode: string;
  region: {
    province: string;
    district: string | null;
    neighborhood: string | null;
    tong: string | null;
    ban: string | null;
  };
  totalPopulation: number;
  ageBands: {
    age60to69: number;
    age70to79: number;
    age80to89: number;
    age90to99: number;
    age100Plus: number;
  };
  age70Plus: number;
  age80Plus: number;
  age70PlusShare: number;
}

function populationNumber(value: string | undefined): number {
  const parsed = Number(value?.replaceAll(",", "") ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullable(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getAgePopulation(
  query: {
    administrationCode: string;
    fromYearMonth: string;
    toYearMonth: string;
    level?: string;
    registrationType?: string;
    page?: number;
  },
  options: { serviceKey?: string; fetcher?: PublicDataFetch } = {},
): Promise<PopulationRecord[]> {
  const serviceKey = options.serviceKey ?? requirePublicDataServiceKey();
  const url = new URL(POPULATION_URL);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("admmCd", query.administrationCode);
  url.searchParams.set("srchFrYm", query.fromYearMonth);
  url.searchParams.set("srchToYm", query.toYearMonth);
  url.searchParams.set("lv", query.level ?? "7");
  url.searchParams.set("regSeCd", query.registrationType ?? "1");
  url.searchParams.set("type", "JSON");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("pageNo", String(query.page ?? 1));

  const payload = await fetchPublicDataJson<PopulationEnvelope>(
    url,
    options.fetcher,
  );
  const body = payload.Response ?? payload.response ?? payload;
  if (!body.head) {
    throw new PublicDataError(
      "주민등록 인구 API 응답에 헤더가 없습니다.",
      "INVALID_UPSTREAM_RESPONSE",
    );
  }
  if (!["00", "0", "INFO-0"].includes(body.head.resultCode)) {
    throw new PublicDataError(
      body.head.resultMsg || "주민등록 인구 API 호출에 실패했습니다.",
      "UPSTREAM_API_ERROR",
    );
  }

  const items = body.items;
  if (!items || typeof items === "string" || items.item == null) return [];
  const records = Array.isArray(items.item) ? items.item : [items.item];

  return records.map((item) => {
    const totalPopulation = populationNumber(item.totNmprCnt);
    const age60to69 =
      populationNumber(item.male60AgeNmprCnt) +
      populationNumber(item.feml60AgeNmprCnt);
    const age70to79 =
      populationNumber(item.male70AgeNmprCnt) +
      populationNumber(item.feml70AgeNmprCnt);
    const age80to89 =
      populationNumber(item.male80AgeNmprCnt) +
      populationNumber(item.feml80AgeNmprCnt);
    const age90to99 =
      populationNumber(item.male90AgeNmprCnt) +
      populationNumber(item.feml90AgeNmprCnt);
    const age100Plus =
      populationNumber(item.male100AgeNmprCnt) +
      populationNumber(item.feml100AgeNmprCnt);
    const age70Plus = age70to79 + age80to89 + age90to99 + age100Plus;
    const age80Plus = age80to89 + age90to99 + age100Plus;

    return {
      statisticsMonth: item.statsYm,
      administrationCode: item.admmCd,
      region: {
        province: item.ctpvNm,
        district: nullable(item.sggNm),
        neighborhood: nullable(item.dongNm),
        tong: nullable(item.tong),
        ban: nullable(item.ban),
      },
      totalPopulation,
      ageBands: {
        age60to69,
        age70to79,
        age80to89,
        age90to99,
        age100Plus,
      },
      age70Plus,
      age80Plus,
      age70PlusShare:
        totalPopulation === 0
          ? 0
          : Math.round((age70Plus / totalPopulation) * 1_000) / 10,
    };
  });
}
