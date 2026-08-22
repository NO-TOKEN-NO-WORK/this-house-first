import {
  BRIEFING_CATEGORIES,
  BRIEFING_CATEGORY_LABEL,
  BRIEFING_MAX_LINES,
  CALL_RESULT_LABEL,
  CHECK_KIND_LABEL,
  CheckKind,
  CONVERSATION_ONGOING_MAX,
  CONVERSATION_SUGGESTION_MAX,
  CONVERSATION_SUMMARY_MAX,
  isBriefingCategory,
  isCallResult,
  isCheckKind,
  isVisitResult,
  VISIT_RESULT_LABEL,
} from "../domain";
import { formatEvidenceDate, formatHistoryDate } from "../board/format";
import type {
  BriefingConversationSuggestion,
  BriefingConversationSummary,
  BriefingEvidence,
  BriefingHandoverItem,
  BriefingSourceEvent,
  BriefingStatement,
  SubjectBriefingView,
  UnverifiedBriefingStatement,
  UnverifiedSubjectBriefing,
} from "./types";

/**
 * 근거 대조와 근거 문구 만들기 — 순수 함수 (ADR-0024 경계 2).
 *
 * 모델은 문장마다 근거 기록을 함께 내야 한다. 여기서 하는 일은 두 가지다.
 *  1. **대조**: 그 id가 실재하고 **해당 대상자의 것인지** 본다. 통과 못한 문장은 버린다.
 *  2. **근거 문구 생성**: 화면에 찍히는 `"8/14 전화 · 괜찮았어요"`는 모델 출력이 아니라
 *     `CheckEvent` 행 + 도메인 상수에서 만든다. 모델이 날짜나 결과를 지어내도 화면에 닿지 않는다.
 *
 * 위험 사유를 UI가 재작성하지 않는 원칙(AGENTS.md 도메인 규칙 3)을 브리핑으로 넓힌 것이다.
 *
 * `service.ts`에서 떼어낸 이유는 하나다: **DB 없이 검사할 수 있어야 한다.** 이 파일이 이 기능의
 * 안전장치이므로, prisma 목을 세워야만 돌아가는 자리에 두면 경계가 검사되지 않은 채 바뀐다.
 */

/** 문장이 지나치게 길면 화면이 아니라 서술이 된다 — 60대 사용자 기준 (PRD §9) */
const TEXT_LIMIT = 500;
/** 부연(이유·진행 중인 사항)은 본문보다 짧게 묶는다 */
const SHORT_TEXT_LIMIT = 200;

function cleanText(value: string, limit = TEXT_LIMIT): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 0 && text.length <= limit ? text : null;
}

/** 근거 한 줄을 DB 행에서 만든다. 도메인 밖 결과값이면 근거로 쓰지 않는다 */
export function evidenceOf(event: BriefingSourceEvent): BriefingEvidence | null {
  if (!isCheckKind(event.kind)) return null;
  const kind = event.kind;

  const resultLabel =
    kind === CheckKind.CALL
      ? isCallResult(event.result)
        ? CALL_RESULT_LABEL[event.result]
        : null
      : isVisitResult(event.result)
        ? VISIT_RESULT_LABEL[event.result]
        : null;
  if (!resultLabel) return null;

  const kindLabel = CHECK_KIND_LABEL[kind];
  return {
    checkEventId: event.id,
    date: event.date,
    dateLabel: formatHistoryDate(event.date),
    kind,
    kindLabel,
    result: event.result as BriefingEvidence["result"],
    resultLabel,
    // 다이얼로그 안에서 한 줄을 넘기지 않게 요일을 뺀 짧은 날짜를 쓴다
    label: `${formatEvidenceDate(event.date)} ${kindLabel} · ${resultLabel}`,
  };
}

export interface VerifyBriefingOptions {
  subjectId: string;
  output: UnverifiedSubjectBriefing;
  /** 모델에게 준 별칭 → 실제 `CheckEvent.id`. 캐시에서 되읽을 때는 항등 사상이다 */
  sourceIdByAlias: ReadonlyMap<string, string>;
  sourceEvents: readonly BriefingSourceEvent[];
  generatedAt: Date;
}

/**
 * 모델 산출물을 화면이 받는 모양으로 바꾼다. 통과하지 못한 문장은 조용히 사라진다 —
 * 빈 브리핑은 정상 상태이며, 채우려고 근거 없는 추측을 넣지 않는다 (ADR-0024 결과).
 */
export function verifySubjectBriefing(
  options: VerifyBriefingOptions,
): SubjectBriefingView {
  const eventById = new Map(
    options.sourceEvents
      // 남의 기록이 섞여 들어오지 않게 대상자 소유권을 여기서 한 번 더 본다
      .filter((event) => event.subjectId === options.subjectId)
      .map((event) => [event.id, event] as const),
  );

  function resolve(alias: string): BriefingEvidence | null {
    const sourceId = options.sourceIdByAlias.get(alias);
    const event = sourceId ? eventById.get(sourceId) : undefined;
    return event ? evidenceOf(event) : null;
  }

  function toStatement(
    raw: UnverifiedBriefingStatement,
    limit = TEXT_LIMIT,
  ): BriefingStatement | null {
    const text = cleanText(raw.text, limit);
    const source = resolve(raw.sourceCheckEventId);
    return text && source ? { text, source } : null;
  }

  // 한 축(category)당 하나만 남기고 도메인 순서로 정렬한다
  const byCategory = new Map<string, BriefingHandoverItem>();
  for (const item of options.output.handover) {
    if (!isBriefingCategory(item.category) || byCategory.has(item.category)) {
      continue;
    }
    const statement = toStatement(item);
    if (!statement) continue;
    byCategory.set(item.category, {
      ...statement,
      category: item.category,
      categoryLabel: BRIEFING_CATEGORY_LABEL[item.category],
    });
  }
  const handover = BRIEFING_CATEGORIES.map((category) => byCategory.get(category))
    .filter((item): item is BriefingHandoverItem => item !== undefined)
    .slice(0, BRIEFING_MAX_LINES);

  const seenQuestions = new Set<string>();
  const conversationSuggestions: BriefingConversationSuggestion[] = [];
  for (const item of options.output.conversationSuggestions) {
    if (conversationSuggestions.length === CONVERSATION_SUGGESTION_MAX) break;
    const question = cleanText(item.question);
    const reason = cleanText(item.reason, SHORT_TEXT_LIMIT);
    const source = resolve(item.sourceCheckEventId);
    if (!question || !reason || !source || seenQuestions.has(question)) continue;
    seenQuestions.add(question);
    const emphasis = item.emphasis?.replace(/\s+/g, " ").trim() ?? "";
    conversationSuggestions.push({
      question,
      // 질문에 없는 구절을 굵게 칠하려면 UI가 문장을 다시 써야 한다 — 도메인 규칙 3이 막는 일이다
      emphasis: emphasis && question.includes(emphasis) ? emphasis : null,
      reason,
      source,
    });
  }

  const seenSummarySources = new Set<string>();
  const conversationSummaries: BriefingConversationSummary[] = [];
  for (const item of options.output.conversationSummaries) {
    if (conversationSummaries.length === CONVERSATION_SUMMARY_MAX) break;
    const statement = toStatement(item);
    // 기록 한 건에 요약도 한 건이다 — 상세 모달이 기록별로 하나만 읽는다
    if (!statement || seenSummarySources.has(statement.source.checkEventId)) {
      continue;
    }
    seenSummarySources.add(statement.source.checkEventId);
    conversationSummaries.push({
      ...statement,
      ongoingItems: item.ongoingItems
        .map((entry) => toStatement(entry, SHORT_TEXT_LIMIT))
        .filter((entry): entry is BriefingStatement => entry !== null)
        .slice(0, CONVERSATION_ONGOING_MAX),
    });
  }

  return {
    handover,
    conversationSuggestions,
    conversationSummaries,
    generatedAt: options.generatedAt.toISOString(),
  };
}

/**
 * 화면 모양에서 저장 모양으로 되돌린다 — 근거 문구는 저장하지 않는다(읽을 때 다시 만든다).
 * 대조를 통과한 문장만 담기므로 버려진 문장이 캐시에 남아 다음 열람에 되살아나지 않는다.
 */
export function toStoredBriefing(
  view: SubjectBriefingView,
): UnverifiedSubjectBriefing {
  const statement = (item: BriefingStatement): UnverifiedBriefingStatement => ({
    text: item.text,
    sourceCheckEventId: item.source.checkEventId,
  });
  return {
    handover: view.handover.map((item) => ({
      ...statement(item),
      category: item.category,
    })),
    conversationSuggestions: view.conversationSuggestions.map((item) => ({
      question: item.question,
      emphasis: item.emphasis,
      reason: item.reason,
      sourceCheckEventId: item.source.checkEventId,
    })),
    conversationSummaries: view.conversationSummaries.map((item) => ({
      ...statement(item),
      ongoingItems: item.ongoingItems.map(statement),
    })),
  };
}

/** 브리핑에 보여 줄 것이 하나도 없는가 — 화면이 빈 상태 문구를 고를 때 쓴다 */
export function isEmptyBriefing(view: SubjectBriefingView): boolean {
  return (
    view.handover.length === 0 &&
    view.conversationSuggestions.length === 0 &&
    view.conversationSummaries.length === 0
  );
}
