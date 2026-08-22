/**
 * 담당자 화면 표기 변환 — 순수 함수 (Figma ① 8:1832, ② 3:527).
 *
 * 화면에서 날짜·나이·동 이름을 각자 만들면 같은 값이 화면마다 다르게 보인다. 변환은 여기서만 한다.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * `"2026-08-21"` → `"8월 21일(금)"`
 *
 * `AlertDay.date`는 이미 KST 기준 날짜 문자열이므로 여기서 시간대를 다시 옮기지 않는다.
 * 요일만 UTC 기준으로 계산한다 — 날짜 문자열을 그대로 UTC 자정에 놓으면 요일이 어긋나지 않는다.
 */
export function formatBoardDate(isoDate: string): string {
  const m = ISO_DATE.exec(isoDate);
  if (!m) throw new Error(`YYYY-MM-DD 형식이 아닙니다: ${isoDate}`);
  const [, y, mo, d] = m as unknown as [string, string, string, string];
  const weekday =
    WEEKDAY_LABEL[new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()];
  return `${Number(mo)}월 ${Number(d)}일(${weekday})`;
}

/** 경보일 날짜에서 나이 계산 기준 연도를 뽑는다 — 스코어링 엔진과 같은 기준을 쓰기 위한 것 */
export function yearOfIsoDate(isoDate: string): number {
  const m = ISO_DATE.exec(isoDate);
  if (!m) throw new Error(`YYYY-MM-DD 형식이 아닙니다: ${isoDate}`);
  return Number(m[1]);
}

/**
 * 나이 — 생년만 있으므로 연도 차로 계산한다. 스코어링 엔진(score.ts)의 나이 계산과 같은 식이어야
 * 화면의 "88세"와 위험 사유의 "(88세)"가 어긋나지 않는다.
 */
export function ageOf(birthYear: number, year: number): number {
  return year - birthYear;
}

/** 행정동 이름으로 볼 수 있는 토큰 — "…동/읍/면"으로 끝나되 "…구·시"는 아니다 */
const DONG = /(?:^|\s)([가-힣A-Za-z0-9]+[동읍면])(?=\s|$)/;

/**
 * 주소에서 담당 구역 이름만 뽑는다 (Figma ① "8월 21일(금) · 행복동").
 * `"대구광역시 서구 비산동 1234-5"` → `"비산동"`. 못 찾으면 null — 화면에서 통째로 생략한다.
 */
export function dongOf(address: string): string | null {
  return DONG.exec(address)?.[1] ?? null;
}
