/**
 * 경보일 날짜 표기 변환 — 순수 함수.
 *
 * 기상청 API는 `YYYYMMDD`를 쓰고, `AlertDay.date`는 `"YYYY-MM-DD"`(KST, unique)로 저장한다
 * (prisma/schema.prisma). 두 표기를 섞으면 같은 날짜로 경보일이 두 개 생기므로 변환은 여기서만 한다.
 */

const COMPACT_DATE = /^(\d{4})(\d{2})(\d{2})$/;

function parts(compact: string): [string, string, string] {
  const m = COMPACT_DATE.exec(compact);
  if (!m) throw new Error(`YYYYMMDD 형식이 아닙니다: ${compact}`);
  const [, y, mo, d] = m as unknown as [string, string, string, string];
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`날짜 범위를 벗어났습니다: ${compact}`);
  }
  return [y, mo, d];
}

/** "20260823" → "2026-08-23" */
export function toIsoDate(compact: string): string {
  return parts(compact).join("-");
}

/** "20260823" → 2026. 나이 계산 기준 연도로 스코어링 엔진에 주입한다 (score.ts는 현재 시각에 의존하지 않는다) */
export function yearOfCompactDate(compact: string): number {
  return Number(parts(compact)[0]);
}
