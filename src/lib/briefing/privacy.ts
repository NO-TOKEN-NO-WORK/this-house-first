import type { BriefingModelEvent, BriefingSourceEvent } from "./types";

const PHONE_NUMBER = /(?:\+?82[-.\s]?)?(?:0?1[016789]|0\d{1,2})[-.\s]?\d{3,4}[-.\s]?\d{4}/g;
/**
 * 호칭 앞의 이름 — **호칭은 남긴다.** `[이름 가림] 님`이 남아야 사람 이야기임을 모델이 안다.
 * 띄어쓴 `박영희 님`도 잡는다. 붙여 쓴 경우만 보면 담당자 메모에서 더 흔한 쪽을 놓친다.
 */
const HONORIFIC_NAME =
  /(?<![가-힣])([가-힣]{2,4})(?=\s?(?:님|씨|여사|할머니|할아버지|어르신|선생님))/g;
/** `김씨`처럼 성 한 글자에 붙는 경우 — 뒤에 다른 글자가 이어지면(`아저씨`) 건드리지 않는다 */
const SURNAME_WITH_SUFFIX = /(?<![가-힣])[가-힣](?=씨(?![가-힣]))/g;
/**
 * 호칭 앞이지만 이름이 아닌 말. 지우면 "누구와 사는가·누가 들르는가"라는 생활 맥락이 사라진다 —
 * 브리핑이 뽑아야 할 바로 그 정보다.
 */
const KINSHIP_BEFORE_HONORIFIC = new Set([
  "아드",
  "어머",
  "아버",
  "사모",
  "아저",
  "아주",
  "며느",
  "손자",
  "손녀",
]);
const FULL_ADDRESS = /[가-힣]{2,}(?:특별자치도|특별자치시|광역시|도)\s+[가-힣]{1,}(?:시|군|구)(?:\s+[가-힣0-9]{1,}(?:구|읍|면|동|리|로|길)){1,3}(?:\s+\d+(?:-\d+)?)?/g;
const SHORT_ADDRESS = /[가-힣]{1,}(?:시|군|구)\s+[가-힣0-9]{1,}(?:읍|면|동|리|로|길)(?:\s+\d+(?:-\d+)?)?/g;
/**
 * 시·군·구가 앞에 없는 도로명·지번·동호수 — 담당자 메모에는 이쪽이 더 흔하다
 * ("행복동 중앙로 12-3", "비산동 1번지", "3동 402호").
 * 도로명 앞의 행정동·리 이름까지 함께 삼킨다. 동 이름만 남으면 지우다 만 주소가 된다.
 */
const LOCAL_ADDRESS = /(?:[가-힣]+(?:동|리|읍|면)\s+)?[가-힣]+(?:대?로|길)\s*\d+(?:-\d+)?(?:번길)?/g;
const LOT_ADDRESS = /[가-힣]+(?:동|리)\s*\d+(?:-\d+)?번지/g;
const UNIT_ADDRESS = /\d+동\s*\d+호/g;
// 앞 이름을 **최소로** 먹는다(`+?`). 탐욕적으로 두면 `행복동주민센터`에서 `주민`까지 이름으로
// 먹혀 유형이 `센터`만 남는다 — 남기려던 생활 맥락이 그만큼 깎인다. 긴 유형을 먼저 시도한다.
// 한 글자 고유명(`봄병원`)도 식별자가 될 수 있으므로 접두부를 한 글자부터 찾는다.
const NAMED_INSTITUTION =
  /[가-힣A-Za-z0-9]+?(행정복지센터|주민센터|복지관|보건지소|보건소|경로당|요양원|병원|의원|약국|센터)/g;
const INSTITUTION_TYPES = new Set([
  "행정복지센터",
  "주민센터",
  "복지관",
  "보건지소",
  "보건소",
  "경로당",
  "요양원",
  "병원",
  "의원",
  "약국",
  "센터",
]);

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
    // 넓은 것부터 좁은 것 순으로 지운다 — 시군구가 붙은 주소를 먼저 통째로 잡아야 한다
    .replace(FULL_ADDRESS, "[주소 가림]")
    .replace(SHORT_ADDRESS, "[주소 가림]")
    .replace(LOCAL_ADDRESS, "[주소 가림]")
    .replace(LOT_ADDRESS, "[주소 가림]")
    .replace(UNIT_ADDRESS, "[주소 가림]")
    // 관계어(`따님`·`며느님`)는 남긴다 — 누가 들르는가는 브리핑이 뽑아야 할 맥락이다
    .replace(HONORIFIC_NAME, (match) =>
      KINSHIP_BEFORE_HONORIFIC.has(match) ? match : "[이름 가림]",
    )
    .replace(SURNAME_WITH_SUFFIX, "[이름 가림]")
    // 기관 고유명은 버리고 유형만 남긴다. 유형 자체(`주민센터`)는 더 줄이지 않는다.
    .replace(NAMED_INSTITUTION, (institution, type: string) =>
      INSTITUTION_TYPES.has(institution) ? institution : type,
    )
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
