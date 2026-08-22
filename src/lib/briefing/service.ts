import { prisma } from "../db";
import {
  CALL_RESULT_LABEL,
  CHECK_KIND_LABEL,
  isCallResult,
  isCheckKind,
  isVisitResult,
  VISIT_RESULT_LABEL,
} from "../domain";
import { toStoredBriefing, verifySubjectBriefing } from "./evidence";
import { generateSubjectBriefing, parseUnverifiedBriefing } from "./openai";
import { toBriefingModelEvents } from "./privacy";
import type {
  BriefingSourceEvent,
  SubjectBriefingView,
  UnverifiedSubjectBriefing,
} from "./types";

/**
 * 대상자 맥락 브리핑 (FR-12 · ADR-0024) — 확인 기록 → 인수인계 3줄 · 대화 추천 · 기록별 대화 요약.
 *
 * 이 파일은 DB와 캐시만 맡는다. 근거 대조와 근거 문구 만들기는 `evidence.ts`의 순수 함수다 —
 * 이 기능의 안전장치이므로 prisma 없이 검사할 수 있는 자리에 둔다.
 *
 * 캐시 규칙 하나로 외부 호출을 묶는다: **새 확인 기록이 없으면 다시 만들지 않는다.**
 * 저장된 문장도 열람할 때마다 같은 대조를 다시 통과해야 한다 — 그 사이 기록이 지워졌으면
 * 그 문장은 화면에 닿지 않는다.
 *
 * ⚠️ 이 모듈은 `RiskAssessment`를 읽지 않는다. 위험 점수·등급·확인 순서는 규칙 엔진 단독이며
 *    (ADR-0005) 브리핑은 "만나서 무엇을 확인할까"만 답한다.
 */

const SOURCE_EVENT_LIMIT = 12;

/** 모델에게는 도메인 상수가 만든 라벨을 준다 — 저장값(`OK`·`CALL`)은 뜻이 통하지 않는다 */
function labelled(event: BriefingSourceEvent): BriefingSourceEvent {
  return {
    ...event,
    kind: isCheckKind(event.kind) ? CHECK_KIND_LABEL[event.kind] : event.kind,
    result: isCallResult(event.result)
      ? CALL_RESULT_LABEL[event.result]
      : isVisitResult(event.result)
        ? VISIT_RESULT_LABEL[event.result]
        : event.result,
  };
}

function parseStoredOutput(content: string): UnverifiedSubjectBriefing | null {
  try {
    return parseUnverifiedBriefing(content);
  } catch {
    // 저장된 JSON이 깨졌거나 예전 모양이면 캐시가 없는 것으로 본다 — 다음 열람이 다시 만든다
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
      return verifySubjectBriefing({
        subjectId,
        output,
        sourceIdByAlias: identityAliases,
        sourceEvents,
        generatedAt: cached.updatedAt,
      });
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
    sourceEvents.map(labelled),
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
  // 대조를 통과한 문장만 저장한다 — 버려진 문장이 캐시에 남아 다음 열람에 되살아나지 않게
  const content = JSON.stringify(toStoredBriefing(verified));
  const saved = await prisma.subjectBriefing.upsert({
    where: { subjectId },
    update: { sourceCheckEventId: latestSourceId, content },
    create: { subjectId, sourceCheckEventId: latestSourceId, content },
    select: { updatedAt: true },
  });
  return { ...verified, generatedAt: saved.updatedAt.toISOString() };
}
