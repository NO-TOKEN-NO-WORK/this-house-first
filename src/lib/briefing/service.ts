import { prisma } from "../db";
import {
  BRIEFING_CATEGORY_LABEL,
  CALL_RESULT_LABEL,
  CHECK_KIND_LABEL,
  CheckKind,
  isBriefingCategory,
  isCallResult,
  isCheckKind,
  isVisitResult,
  VISIT_RESULT_LABEL,
} from "../domain";
import { formatHistoryDate } from "../board/format";
import { generateSubjectBriefing, parseUnverifiedBriefing } from "./openai";
import { toBriefingModelEvents } from "./privacy";
import type {
  BriefingEvidence,
  BriefingSourceEvent,
  SubjectBriefingView,
  UnverifiedSubjectBriefing,
} from "./types";

const SOURCE_EVENT_LIMIT = 12;
const OUTPUT_TEXT_LIMIT = 500;
const ONGOING_TEXT_LIMIT = 200;

function cleanText(value: string, limit = OUTPUT_TEXT_LIMIT): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 0 && text.length <= limit ? text : null;
}

function evidenceOf(event: BriefingSourceEvent): BriefingEvidence | null {
  if (!isCheckKind(event.kind)) return null;
  const kind = event.kind;
  const kindLabel = CHECK_KIND_LABEL[kind];
  if (kind === CheckKind.CALL) {
    if (!isCallResult(event.result)) return null;
    const resultLabel = CALL_RESULT_LABEL[event.result];
    return {
      checkEventId: event.id,
      date: event.date,
      dateLabel: formatHistoryDate(event.date),
      kind,
      kindLabel,
      result: event.result,
      resultLabel,
      label: `${formatHistoryDate(event.date)} ${kindLabel} · ${resultLabel}`,
    };
  }
  if (!isVisitResult(event.result)) return null;
  const resultLabel = VISIT_RESULT_LABEL[event.result];
  return {
    checkEventId: event.id,
    date: event.date,
    dateLabel: formatHistoryDate(event.date),
    kind,
    kindLabel,
    result: event.result,
    resultLabel,
    label: `${formatHistoryDate(event.date)} ${kindLabel} · ${resultLabel}`,
  };
}

/**
 * 모델의 sourceCheckEventId를 실제 행과 대조한다. 다른 대상자 id·없는 id·도메인 밖 결과는
 * 문장 단위로 버리며, 근거 라벨은 항상 DB 행과 domain.ts에서 다시 만든다 (ADR-0024).
 */
export function verifySubjectBriefing(options: {
  subjectId: string;
  output: UnverifiedSubjectBriefing;
  sourceIdByAlias: ReadonlyMap<string, string>;
  sourceEvents: BriefingSourceEvent[];
  generatedAt: Date;
}): SubjectBriefingView | null {
  const eventById = new Map(
    options.sourceEvents
      .filter((event) => event.subjectId === options.subjectId)
      .map((event) => [event.id, event] as const),
  );
  const resolveEvidence = (alias: string): BriefingEvidence | null => {
    const sourceId = options.sourceIdByAlias.get(alias);
    const event = sourceId ? eventById.get(sourceId) : undefined;
    return event ? evidenceOf(event) : null;
  };

  const promptText = options.output.todayPrompt
    ? cleanText(options.output.todayPrompt.text)
    : null;
  const promptSource = options.output.todayPrompt
    ? resolveEvidence(options.output.todayPrompt.sourceCheckEventId)
    : null;
  const todayPrompt = promptText && promptSource
    ? { text: promptText, source: promptSource }
    : null;

  const usedCategories = new Set<string>();
  const handover = options.output.handover.flatMap((item) => {
    if (!isBriefingCategory(item.category) || usedCategories.has(item.category)) {
      return [];
    }
    const text = cleanText(item.text);
    const source = resolveEvidence(item.sourceCheckEventId);
    if (!text || !source) return [];
    usedCategories.add(item.category);
    return [{
      category: item.category,
      categoryLabel: BRIEFING_CATEGORY_LABEL[item.category],
      text,
      source,
    }];
  }).slice(0, 3);

  const usedConversationSources = new Set<string>();
  const conversationSummaries = options.output.conversationSummaries.flatMap(
    (item) => {
      const text = cleanText(item.text);
      const source = resolveEvidence(item.sourceCheckEventId);
      if (!text || !source || usedConversationSources.has(source.checkEventId)) {
        return [];
      }
      usedConversationSources.add(source.checkEventId);
      return [{
        text,
        source,
        ongoingItems: item.ongoingItems
          .flatMap((entry) => {
            const ongoingText = cleanText(entry.text, ONGOING_TEXT_LIMIT);
            const ongoingSource = resolveEvidence(entry.sourceCheckEventId);
            return ongoingText && ongoingSource
              ? [{ text: ongoingText, source: ongoingSource }]
              : [];
          })
          .slice(0, 3),
      }];
    },
  ).slice(0, 3);

  if (!todayPrompt && handover.length === 0 && conversationSummaries.length === 0) {
    return null;
  }
  return {
    todayPrompt,
    handover,
    conversationSummaries,
    generatedAt: options.generatedAt.toISOString(),
  };
}

function storedOutput(view: SubjectBriefingView): UnverifiedSubjectBriefing {
  return {
    todayPrompt: view.todayPrompt
      ? {
          text: view.todayPrompt.text,
          sourceCheckEventId: view.todayPrompt.source.checkEventId,
        }
      : null,
    handover: view.handover.map((item) => ({
      category: item.category,
      text: item.text,
      sourceCheckEventId: item.source.checkEventId,
    })),
    conversationSummaries: view.conversationSummaries.map((item) => ({
      text: item.text,
      sourceCheckEventId: item.source.checkEventId,
      ongoingItems: item.ongoingItems.map((entry) => ({
        text: entry.text,
        sourceCheckEventId: entry.source.checkEventId,
      })),
    })),
  };
}

function parseStoredOutput(content: string): UnverifiedSubjectBriefing | null {
  try {
    return parseUnverifiedBriefing(content);
  } catch {
    return null;
  }
}

/** 한 대상자만 온디맨드 생성하며 최신 CheckEvent가 같으면 DB 캐시를 그대로 쓴다. */
export async function getSubjectBriefing(
  subjectId: string,
): Promise<SubjectBriefingView | null> {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      name: true,
      phone: true,
      worker: { select: { name: true } },
      building: { select: { address: true, roadAddress: true } },
      checkEvents: {
        orderBy: { createdAt: "desc" },
        take: SOURCE_EVENT_LIMIT,
        select: {
          id: true,
          subjectId: true,
          kind: true,
          result: true,
          memo: true,
          alertDay: { select: { date: true } },
        },
      },
    },
  });
  if (!subject || subject.checkEvents.length === 0) return null;

  const sourceEvents: BriefingSourceEvent[] = subject.checkEvents.map((event) => ({
    id: event.id,
    subjectId: event.subjectId,
    date: event.alertDay.date,
    kind: event.kind,
    result: event.result,
    memo: event.memo?.trim() ?? "",
  }));
  const latestSourceId = sourceEvents[0]!.id;
  const cached = await prisma.subjectBriefing.findUnique({
    where: { subjectId },
  });

  if (cached?.sourceCheckEventId === latestSourceId) {
    const output = parseStoredOutput(cached.content);
    if (output) {
      const identityAliases = new Map(
        sourceEvents.map((event) => [event.id, event.id] as const),
      );
      const verified = verifySubjectBriefing({
        subjectId,
        output,
        sourceIdByAlias: identityAliases,
        sourceEvents,
        generatedAt: cached.updatedAt,
      });
      if (verified) return verified;
    }
  }

  const privateTerms = [
    subject.name,
    subject.phone ?? "",
    subject.worker.name,
    subject.building.address,
    subject.building.roadAddress ?? "",
  ];
  const { events: modelEvents, sourceIdByAlias } = toBriefingModelEvents(
    sourceEvents.map((event) => ({
      ...event,
      kind: isCheckKind(event.kind) ? CHECK_KIND_LABEL[event.kind] : event.kind,
      result: isCallResult(event.result)
        ? CALL_RESULT_LABEL[event.result]
        : isVisitResult(event.result)
          ? VISIT_RESULT_LABEL[event.result]
          : event.result,
    })),
    privateTerms,
  );
  const output = await generateSubjectBriefing(modelEvents);
  const verified = verifySubjectBriefing({
    subjectId,
    output,
    sourceIdByAlias,
    sourceEvents,
    generatedAt: new Date(),
  });
  if (!verified) return null;

  const saved = await prisma.subjectBriefing.upsert({
    where: { subjectId },
    update: {
      sourceCheckEventId: latestSourceId,
      content: JSON.stringify(storedOutput(verified)),
    },
    create: {
      subjectId,
      sourceCheckEventId: latestSourceId,
      content: JSON.stringify(storedOutput(verified)),
    },
    select: { updatedAt: true },
  });
  return { ...verified, generatedAt: saved.updatedAt.toISOString() };
}
