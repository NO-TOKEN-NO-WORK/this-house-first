import {
  fetchPublicDataJson,
  PublicDataError,
  type PublicDataFetch,
  requirePublicDataServiceKey,
} from "../public-data/client";
import type { BrTitleEnvelope, BrTitleItem } from "./types";

/**
 * 건축HUB 건축물대장 표제부 조회 클라이언트 — 서버 전용 (FR-2).
 * 공통 처리(키 정규화·타임아웃·XML 오류 해석)는 public-data/client.ts를 재사용한다.
 * `PUBLIC_DATA_SERVICE_KEY`는 절대 클라이언트로 노출하지 않는다 (AGENTS.md 금지 사항).
 */

const TITLE_URL =
  "https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo";

export interface TitleQuery {
  /** 시군구코드 5자리 */
  sigunguCd: string;
  /** 법정동코드 5자리 */
  bjdongCd: string;
  /** 대지구분: 0 대지(기본) | 1 산 | 2 블록 */
  platGbCd?: "0" | "1" | "2";
  /** 번 (4자리 zero-pad) — 생략 시 법정동 전체 */
  bun?: string;
  /** 지 (4자리 zero-pad) */
  ji?: string;
  /** 페이지 크기 (기본 100) */
  numOfRows?: number;
  /** 페이지 번호 (기본 1) — 법정동 단위 전수 조회 시 시드가 사용 */
  pageNo?: number;
}

export interface TitlePage {
  items: BrTitleItem[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
}

/** 건축HUB 응답 헤더 수준의 오류 (resultCode != 00, 형식 불일치) */
export class BldgHubError extends PublicDataError {
  constructor(message: string, code = "BLDG_HUB_ERROR", status = 502) {
    super(message, code, status);
    this.name = "BldgHubError";
  }
}

function unwrapItems<T>(items: { item?: T | T[] } | string | undefined): T[] {
  if (!items || typeof items === "string") return [];
  const it = items.item;
  if (it == null) return [];
  return Array.isArray(it) ? it : [it];
}

/** 표제부 1페이지 조회. 법정동 단위(bun/ji 생략)로도 조회 가능 */
export async function fetchBuildingTitles(
  q: TitleQuery,
  options: { serviceKey?: string; fetcher?: PublicDataFetch } = {},
): Promise<TitlePage> {
  const serviceKey = options.serviceKey ?? requirePublicDataServiceKey();
  const url = new URL(TITLE_URL);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("sigunguCd", q.sigunguCd);
  url.searchParams.set("bjdongCd", q.bjdongCd);
  url.searchParams.set("numOfRows", String(q.numOfRows ?? 100));
  url.searchParams.set("pageNo", String(q.pageNo ?? 1));
  url.searchParams.set("_type", "json");
  if (q.platGbCd) url.searchParams.set("platGbCd", q.platGbCd);
  if (q.bun) url.searchParams.set("bun", q.bun.padStart(4, "0"));
  if (q.ji) url.searchParams.set("ji", q.ji.padStart(4, "0"));

  const json = await fetchPublicDataJson<BrTitleEnvelope>(url, options.fetcher);
  const header = json.response?.header;
  if (!header) {
    throw new BldgHubError(
      "건축HUB 응답 형식을 해석할 수 없습니다",
      "INVALID_UPSTREAM_RESPONSE",
    );
  }
  if (header.resultCode !== "00") {
    throw new BldgHubError(
      `건축HUB resultCode ${header.resultCode}: ${header.resultMsg}`,
      "UPSTREAM_API_ERROR",
    );
  }
  const body = json.response?.body;
  return {
    items: unwrapItems(body?.items),
    totalCount: Number(body?.totalCount ?? 0),
    pageNo: Number(body?.pageNo ?? q.pageNo ?? 1),
    numOfRows: Number(body?.numOfRows ?? q.numOfRows ?? 100),
  };
}
