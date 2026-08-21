/**
 * 카카오 로컬 API (지오코딩) — 서버 전용 (ADR-0007).
 * `KAKAO_REST_KEY`는 클라이언트로 노출하지 않는다. 지도 SDK는 별도 JS 키를 쓴다.
 * https://developers.kakao.com/docs/latest/ko/local/dev-guide#address-coord
 */

const BASE_URL = "https://dapi.kakao.com/v2/local";

export class KakaoLocalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KakaoLocalError";
  }
}

interface KakaoAddressDocument {
  address_name: string;
  address_type: "REGION" | "REGION_ADDR" | "ROAD" | "ROAD_ADDR";
  x: string; // 경도
  y: string; // 위도
  address: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    /** 행정동 코드 10자리 */
    h_code: string;
    /** 법정동 코드 10자리 */
    b_code: string;
    mountain_yn: "Y" | "N";
    main_address_no: string;
    sub_address_no: string;
  } | null;
  road_address: { address_name: string } | null;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  addressName: string;
  /** 법정동코드 10자리 = 시군구 5 + 법정동 5 */
  bCode: string | null;
  addressType: KakaoAddressDocument["address_type"];
}

function getRestKey(): string {
  const key = process.env.KAKAO_REST_KEY?.trim();
  if (!key) {
    throw new KakaoLocalError(
      "KAKAO_REST_KEY가 비어 있습니다. Kakao Developers 앱의 REST API 키를 .env에 넣으세요.",
    );
  }
  return key;
}

/** 주소 검색 → 첫 결과의 좌표·법정동코드. 결과 없으면 null */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({ query, size: "1" });
  const res = await fetch(`${BASE_URL}/search/address.json?${params.toString()}`, {
    headers: { Authorization: `KakaoAK ${getRestKey()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new KakaoLocalError(`카카오 로컬 HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { documents: KakaoAddressDocument[] };
  const doc = json.documents[0];
  if (!doc) return null;
  return {
    lat: Number(doc.y),
    lng: Number(doc.x),
    addressName: doc.address_name,
    bCode: doc.address?.b_code || null,
    addressType: doc.address_type,
  };
}

/**
 * "대구 서구 비산동" 같은 법정동 질의 → 건축HUB 조회용 코드 분해.
 * 카카오는 법정동코드를 10자리(b_code)로 주고, 건축HUB는 앞 5자리(sigunguCd)·뒤 5자리(bjdongCd)로 받는다.
 */
export async function resolveRegionCodes(
  query: string,
): Promise<{ sigunguCd: string; bjdongCd: string; addressName: string } | null> {
  const r = await geocodeAddress(query);
  if (!r?.bCode || r.bCode.length !== 10) return null;
  return {
    sigunguCd: r.bCode.slice(0, 5),
    bjdongCd: r.bCode.slice(5),
    addressName: r.addressName,
  };
}
