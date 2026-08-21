/**
 * 국토교통부 건축HUB 건축물대장정보 서비스 — 표제부 조회(getBrTitleInfo) 응답 항목.
 * 공공데이터포털: https://www.data.go.kr/data/15134735/openapi.do
 *
 * 숫자형 필드는 `_type=json`에서도 문자열로 올 수 있어 string | number로 둔다.
 * 여기 나열한 필드만 사용한다 (전체 응답은 70여 개 필드).
 */
export interface BrTitleItem {
  /** 건축물대장 관리번호 — 건물 단위 고유키. "건물은 진짜" 증빙 */
  mgmBldrgstPk: string;
  /** 대지위치 (지번 주소) */
  platPlc: string;
  /** 도로명 대지위치 */
  newPlatPlc?: string;
  /** 건물명 */
  bldNm?: string;
  /** 대장구분명: 일반 | 집합 */
  regstrGbCdNm?: string;
  /** 대장종류명: 일반건축물 | 총괄표제부 | 표제부 | 전유부 */
  regstrKindCdNm?: string;
  /** 주용도코드 (단독주택 계열 0100x) */
  mainPurpsCd?: string;
  /** 주용도명 (예: 단독주택, 다가구주택, 공동주택, 제2종근린생활시설) */
  mainPurpsCdNm?: string;
  /** 기타용도 */
  etcPurps?: string;
  /** 구조명 (예: 벽돌구조, 철근콘크리트구조, 목구조, 경량철골구조) */
  strctCdNm?: string;
  /** 기타구조 */
  etcStrct?: string;
  /** 지붕명 (예: 슬레이트, 기와, (철근)콘크리트) */
  roofCdNm?: string;
  /** 기타지붕 */
  etcRoof?: string;
  /** 사용승인일 YYYYMMDD */
  useAprDay?: string | number;
  /** 지상층수 */
  grndFlrCnt?: string | number;
  /** 지하층수 */
  ugrndFlrCnt?: string | number;
  /** 세대수 */
  hhldCnt?: string | number;
  /** 시군구코드 5자리 */
  sigunguCd?: string | number;
  /** 법정동코드 5자리 */
  bjdongCd?: string | number;
  /** 대지구분코드: 0 대지 | 1 산 | 2 블록 */
  platGbCd?: string | number;
  /** 번 4자리 */
  bun?: string | number;
  /** 지 4자리 */
  ji?: string | number;
}

/** 공공데이터포털 표준 응답 봉투 (게이트웨이 오류는 public-data/client.ts가 XML로 잡는다) */
export interface BrTitleEnvelope {
  response?: {
    header?: { resultCode: string; resultMsg: string };
    body?: {
      items?: { item?: BrTitleItem | BrTitleItem[] } | string;
      numOfRows?: number | string;
      pageNo?: number | string;
      totalCount?: number | string;
    };
  };
}
