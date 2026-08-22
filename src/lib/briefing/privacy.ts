import type { BriefingModelEvent, BriefingSourceEvent } from "./types";

const PHONE_NUMBER = /(?:\+?82[-.\s]?)?(?:0?1[016789]|0\d{1,2})[-.\s]?\d{3,4}[-.\s]?\d{4}/g;
const HONORIFIC_NAME = /[가-힣]{2,4}(?:님|씨|선생님|어르신)/g;
const FULL_ADDRESS = /[가-힣]{2,}(?:특별자치도|특별자치시|광역시|도)\s+[가-힣]{1,}(?:시|군|구)(?:\s+[가-힣0-9]{1,}(?:구|읍|면|동|리|로|길)){1,3}(?:\s+\d+(?:-\d+)?)?/g;
const SHORT_ADDRESS = /[가-힣]{1,}(?:시|군|구)\s+[가-힣0-9]{1,}(?:읍|면|동|리|로|길)(?:\s+\d+(?:-\d+)?)?/g;
// 앞 이름을 **최소로** 먹는다(`{2,}?`). 탐욕적으로 두면 `행복동주민센터`에서 `주민`까지 이름으로
// 먹혀 유형이 `센터`만 남는다 — 남기려던 생활 맥락이 그만큼 깎인다. 긴 유형을 먼저 시도한다.
const NAMED_INSTITUTION =
  /[가-힣A-Za-z0-9]{2,}?(행정복지센터|주민센터|복지관|보건지소|보건소|경로당|요양원|병원|의원|약국|센터)/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 자유 서술이 외부 모델 경계를 넘기 전에 이름·전화·주소·기관명을 제거한다 (ADR-0024).
 * 완전한 비식별화를 주장하지 않으며 합성 대상자 데이터라는 프로젝트 전제가 유지돼야 한다.
 */
export function maskBriefingMemo(
  memo: string,
  privateTerms: readonly string[],
): string {
  let masked = memo;
  for (const term of privateTerms) {
    const normalized = term.trim();
    if (normalized.length < 2) continue;
    masked = masked.replace(new RegExp(escapeRegExp(normalized), "g"), "[가림]");
  }
  return masked
    .replace(PHONE_NUMBER, "[전화 가림]")
    .replace(FULL_ADDRESS, "[주소 가림]")
    .replace(SHORT_ADDRESS, "[주소 가림]")
    .replace(HONORIFIC_NAME, "[이름 가림]")
    // 기관 고유명은 버리고 유형만 남겨 생활 맥락은 보존한다.
    .replace(NAMED_INSTITUTION, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 실제 CheckEvent id도 외부로 보내지 않고 호출마다 event-1 형태로 바꾼다. */
export function toBriefingModelEvents(
  events: BriefingSourceEvent[],
  privateTerms: readonly string[],
): {
  events: BriefingModelEvent[];
  sourceIdByAlias: Map<string, string>;
} {
  const sourceIdByAlias = new Map<string, string>();
  const modelEvents = events.map((event, index) => {
    const alias = `event-${index + 1}`;
    sourceIdByAlias.set(alias, event.id);
    return {
      sourceCheckEventId: alias,
      date: event.date,
      kind: event.kind,
      result: event.result,
      memo: maskBriefingMemo(event.memo, privateTerms),
    };
  });
  return { events: modelEvents, sourceIdByAlias };
}
