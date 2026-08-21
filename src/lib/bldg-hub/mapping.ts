import type { BrTitleItem } from "./types";

/**
 * 건축물대장 표제부 → 스코어링 엔진이 쓰는 건물 속성으로의 순수 매핑 (FR-2).
 * 네트워크에 의존하지 않으므로 단위 테스트 대상이다. 호출부: /api/public-data/buildings, prisma/seed.
 */

export interface BuildingFacts {
  mgmBldrgstPk: string;
  /** 지번 주소 (platPlc) */
  address: string;
  roadAddress: string | null;
  name: string | null;
  builtYear: number | null;
  /** 단독주택 계열 여부 — weights.ts DETACHED_HOUSE ×1.4 적용 기준 */
  isDetached: boolean;
  /** 주거용 건물 여부 — 시드 선별용 (근린생활시설·창고 등 제외) */
  isResidential: boolean;
  /** 위험 사유에 그대로 표시할 구조 라벨 (예: "벽돌구조·슬레이트") */
  structure: string | null;
  mainPurpose: string | null;
  roof: string | null;
  groundFloors: number | null;
  /** 법정동코드 10자리 (sigunguCd + bjdongCd), 둘 다 있을 때만 */
  bjdongCode: string | null;
}

/**
 * 단독주택 계열 주용도명 — 건축법 시행령 [별표 1] 제1호 "단독주택"에 속하는 용도
 * (단독주택·다중주택·다가구주택·공관). 가중치 출처(건축공간연구원 1.4배)도 이 분류 기준.
 * 건축HUB 주용도코드(mainPurpsCd)로는 0100x 대역.
 */
const DETACHED_PURPOSES = ["단독주택", "다중주택", "다가구주택", "공관"];
const DETACHED_PURPOSE_CODE_PREFIX = "0100";

/** 주거용으로 보는 주용도명 키워드 (단독주택 계열 + 공동주택 계열) */
const RESIDENTIAL_KEYWORDS = [
  ...DETACHED_PURPOSES,
  "공동주택",
  "아파트",
  "연립주택",
  "다세대주택",
  "기숙사",
];

/**
 * 단열·축열 취약을 직관적으로 드러내는 지붕 — 사유 라벨에 함께 표시 (PRD F3 예시 "슬레이트").
 * 건축물대장 지붕명은 한자어 표기가 섞여 있다: 와즙(瓦葺)=기와, 초즙(草葺)=초가, 스레트=슬레이트.
 * (대구 서구 비산동 실데이터 확인, 2026-08-22)
 */
const NOTABLE_ROOFS = ["슬레이트", "스레트", "기와", "와즙", "초가", "초즙", "함석"];

function toInt(v: string | number | undefined | null): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function nonEmpty(v: string | undefined | null): string | null {
  const s = v?.trim();
  return s ? s : null;
}

/** 사용승인일 YYYYMMDD → 연도. 비정상 값(0, 빈 값, 1800년 이전)은 null */
export function parseUseAprYear(
  useAprDay: string | number | undefined | null,
): number | null {
  if (useAprDay == null) return null;
  const s = String(useAprDay).trim();
  if (s.length < 4) return null;
  const y = parseInt(s.slice(0, 4), 10);
  if (!Number.isFinite(y) || y < 1800 || y > 2100) return null;
  return y;
}

export function isDetachedPurpose(
  mainPurpose: string | null | undefined,
  mainPurposeCode?: string | null,
): boolean {
  if (mainPurposeCode?.startsWith(DETACHED_PURPOSE_CODE_PREFIX)) return true;
  if (!mainPurpose) return false;
  return DETACHED_PURPOSES.some((p) => mainPurpose.includes(p));
}

export function isResidentialPurpose(
  mainPurpose: string | null | undefined,
): boolean {
  if (!mainPurpose) return false;
  return RESIDENTIAL_KEYWORDS.some((p) => mainPurpose.includes(p));
}

/** "목조, 세멘부로크조" 같은 자유 텍스트 목록을 토큰으로 분해 */
function tokens(v: string | null | undefined): string[] {
  return (v ?? "")
    .split(/[,，/·]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * 코드명 우선, 코드명이 없거나 "기타"면 자유 텍스트(etc*)의 첫 토큰.
 * 건축물대장 etc 필드는 "목조, 세멘벽돌조, 철근콘크리트"처럼 나열이라 그대로 쓰면 사유 카드가 길어진다.
 */
export function pickCodeOrEtc(
  codeName: string | null | undefined,
  etc: string | null | undefined,
): string | null {
  const c = nonEmpty(codeName);
  if (c && !c.includes("기타")) return c;
  return tokens(etc)[0] ?? c;
}

/** 구조명 + (주목할 지붕) → "벽돌구조·슬레이트" 형태의 사유 라벨 */
export function buildStructureLabel(
  structure: string | null | undefined,
  roof: string | null | undefined,
): string | null {
  const parts: string[] = [];
  const s = nonEmpty(structure);
  if (s) parts.push(s);
  // 지붕이 "와즙, 육즙"처럼 목록이면 주목할 토큰 하나만 붙인다
  const notable = tokens(roof).find((t) => NOTABLE_ROOFS.some((k) => t.includes(k)));
  if (notable) parts.push(notable);
  return parts.length ? parts.join("·") : null;
}

function pad(v: string | number | undefined | null, len: number): string | null {
  if (v == null || v === "") return null;
  return String(v).padStart(len, "0");
}

export function toBuildingFacts(item: BrTitleItem): BuildingFacts {
  const mainPurpose = nonEmpty(item.mainPurpsCdNm);
  const roof = pickCodeOrEtc(item.roofCdNm, item.etcRoof);
  const structure = pickCodeOrEtc(item.strctCdNm, item.etcStrct);
  const sigungu = pad(item.sigunguCd, 5);
  const bjdong = pad(item.bjdongCd, 5);
  return {
    mgmBldrgstPk: String(item.mgmBldrgstPk),
    address: (item.platPlc ?? "").trim(),
    roadAddress: nonEmpty(item.newPlatPlc),
    name: nonEmpty(item.bldNm),
    builtYear: parseUseAprYear(item.useAprDay),
    isDetached: isDetachedPurpose(mainPurpose, nonEmpty(item.mainPurpsCd)),
    isResidential: isResidentialPurpose(mainPurpose),
    structure: buildStructureLabel(structure, roof),
    mainPurpose,
    roof,
    groundFloors: toInt(item.grndFlrCnt),
    bjdongCode: sigungu && bjdong ? sigungu + bjdong : null,
  };
}
