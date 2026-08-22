/**
 * 시드 설정 — 시드 대상 지역과 건물 선별 계획 (ADR-0012).
 * 지역을 바꾸려면 REGION.query만 수정한다. 법정동코드는 카카오 로컬 API로 런타임에 해석한다.
 */

export const REGION = {
  /**
   * 대구광역시 서구 비산동.
   * 대구는 폭염일수가 가장 많은 대도시("대프리카")이고, 서구 비산동·내당동 일대는
   * 1970~80년대 단독주택이 밀집한 원도심이라 "노후 주택 × 고령 독거"라는 PRD P2의
   * 위험 프로필을 실제 건축물대장으로 보여주기에 적합하다. (지역 선택은 시연용이며 스펙이 아님)
   */
  query: "대구 서구 비산동",
  /** 건축HUB 표제부 조회 최대 페이지 수 (100건/페이지). 후보가 충분하면 조기 종료 */
  maxPages: 5,
} as const;

/** 건물 선별 슬롯 — 순서가 synthetic.ts의 프로필 buildingSlot과 대응한다 */
export interface SlotSpec {
  label: string;
  /** 우선순위 순 조건. 앞 조건을 만족하는 후보가 없으면 다음 조건으로 완화 */
  prefer: ReadonlyArray<{
    detached: boolean;
    minYear?: number;
    maxYear?: number; // exclusive
    /** 지상층수 하한 — 최상층/옥탑 가구 슬롯은 단층 건물이면 사유가 성립하지 않는다 */
    minFloors?: number;
  }>;
}

const OLD_DETACHED = { detached: true, maxYear: 1980 };
const MID_DETACHED = { detached: true, minYear: 1980, maxYear: 2000 };
const NEW_DETACHED = { detached: true, minYear: 2000 };
const ANY_DETACHED = { detached: true };
const APARTMENT = { detached: false };
/** 최상층 가구 슬롯: 3층 이상 공동주택 (weights.ts TOP_FLOOR의 근거 "꼭대기층 OR 4.1"은 다층 건물 전제) */
const APARTMENT_MULTI_FLOOR = { detached: false, minFloors: 3 };

/**
 * 10개 건물: 1980년 이전 단독 5 · 1980~99 단독 2 · 2000년 이후 단독 1 · 공동주택 2.
 * 비율 근거: 비산동 현황(노후 단독 다수)을 반영하면서 위험 단계 분포가 한쪽으로 쏠리지 않게
 * 최신·공동주택을 섞는다 — 위험 단계 컷오프 캘리브레이션(ADR-0005)에 점수 범위가 넓어야 함.
 */
export const BUILDING_SLOTS: readonly SlotSpec[] = [
  { label: "1980년 이전 단독주택 A", prefer: [OLD_DETACHED, ANY_DETACHED] },
  { label: "1980년 이전 단독주택 B", prefer: [OLD_DETACHED, ANY_DETACHED] },
  { label: "1980년 이전 단독주택 C", prefer: [OLD_DETACHED, ANY_DETACHED] },
  { label: "1980년 이전 단독주택 D", prefer: [OLD_DETACHED, ANY_DETACHED] },
  { label: "1980년 이전 단독주택 E", prefer: [OLD_DETACHED, ANY_DETACHED] },
  { label: "1980~99년 단독주택 A", prefer: [MID_DETACHED, OLD_DETACHED, ANY_DETACHED] },
  { label: "1980~99년 단독주택 B", prefer: [MID_DETACHED, OLD_DETACHED, ANY_DETACHED] },
  { label: "2000년 이후 단독주택", prefer: [NEW_DETACHED, MID_DETACHED, ANY_DETACHED] },
  { label: "공동주택 A", prefer: [APARTMENT, NEW_DETACHED, ANY_DETACHED] },
  { label: "공동주택 B (최상층 가구)", prefer: [APARTMENT_MULTI_FLOOR, APARTMENT, NEW_DETACHED, ANY_DETACHED] },
];

/** 선별 시 결정적 셔플에 쓰는 시드 — 바꾸면 다른 건물 조합이 뽑힌다 */
export const SELECTION_SEED = 20260822;
