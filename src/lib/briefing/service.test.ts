import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BriefingCategory,
  CallResult,
  CheckKind,
  VisitResult,
} from "../domain";
const mocks = vi.hoisted(() => ({
  subjectFindUnique: vi.fn(),
  briefingFindUnique: vi.fn(),
  briefingUpsert: vi.fn(),
  generateSubjectBriefing: vi.fn(),
}));

vi.mock("../db", () => ({
  prisma: {
    subject: { findUnique: mocks.subjectFindUnique },
    subjectBriefing: {
      findUnique: mocks.briefingFindUnique,
      upsert: mocks.briefingUpsert,
    },
  },
}));
vi.mock("./openai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./openai")>()),
  generateSubjectBriefing: mocks.generateSubjectBriefing,
}));

import { getSubjectBriefing, verifySubjectBriefing } from "./service";

describe("맥락 브리핑 근거 검증", () => {
  const sourceEvents = [
    {
      id: "subject-a-call",
      subjectId: "subject-a",
      date: "2026-08-19",
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "무릎이 불편하다고 했다.",
    },
    {
      id: "subject-b-visit",
      subjectId: "subject-b",
      date: "2026-08-20",
      kind: CheckKind.VISIT,
      result: VisitResult.OK,
      memo: "다른 대상자의 기록",
    },
  ];

  it("해당 대상자의 실재 기록만 남기고 근거 문구는 DB 행에서 만든다", () => {
    const result = verifySubjectBriefing({
      subjectId: "subject-a",
      sourceEvents,
      sourceIdByAlias: new Map([
        ["event-1", "subject-a-call"],
        ["event-2", "subject-b-visit"],
      ]),
      output: {
        conversationSuggestions: [{
          question: "무릎은 좀 어떠세요?",
          emphasis: "무릎",
          reason: "최근 무릎이 불편하다고 하셨어요.",
          sourceCheckEventId: "event-1",
        }],
        handover: [
          {
            category: BriefingCategory.CAUTION,
            text: "최근 무릎 불편을 말했다.",
            sourceCheckEventId: "event-1",
          },
          {
            category: BriefingCategory.LIFE_RHYTHM,
            text: "다른 대상자의 생활 리듬",
            sourceCheckEventId: "event-2",
          },
        ],
        conversationSummaries: [{
          text: "무릎 불편을 이야기했다.",
          sourceCheckEventId: "event-1",
          ongoingItems: [{
            text: "다음 통화에서 상태 확인",
            sourceCheckEventId: "event-1",
          }],
        }],
      },
      generatedAt: new Date("2026-08-23T00:00:00.000Z"),
    });

    expect(result?.handover).toHaveLength(1);
    expect(result?.handover[0]).toMatchObject({
      category: BriefingCategory.CAUTION,
      source: {
        checkEventId: "subject-a-call",
        kindLabel: "전화",
        resultLabel: "괜찮았어요",
        label: "8/19 (수) 전화 · 괜찮았어요",
      },
    });
    expect(JSON.stringify(result)).not.toContain("다른 대상자");
  });

  it("근거가 전부 틀리면 재호출하지 않도록 검증된 빈 브리핑으로 만든다", () => {
    const result = verifySubjectBriefing({
      subjectId: "subject-a",
      sourceEvents,
      sourceIdByAlias: new Map([["event-2", "subject-b-visit"]]),
      output: {
        conversationSuggestions: [],
        handover: [{
          category: BriefingCategory.CAUTION,
          text: "근거가 다른 대상자다.",
          sourceCheckEventId: "event-2",
        }],
        conversationSummaries: [],
      },
      generatedAt: new Date(),
    });

    expect(result.handover).toEqual([]);
    expect(result.conversationSuggestions).toEqual([]);
  });
});

describe("맥락 브리핑 캐시", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subjectFindUnique.mockResolvedValue({
      id: "subject-a",
      name: "합성대상자",
      phone: "010-0000-0000",
      worker: { name: "합성담당자" },
      building: { address: "합성동 1", roadAddress: null },
      checkEvents: [{
        id: "latest-event",
        subjectId: "subject-a",
        kind: CheckKind.CALL,
        result: CallResult.OK,
        memo: "아침 산책을 한다고 했다.",
        alertDay: { date: "2026-08-19" },
      }],
    });
  });

  it("최신 CheckEvent id가 같으면 모델을 다시 호출하지 않는다", async () => {
    mocks.briefingFindUnique.mockResolvedValue({
      sourceCheckEventId: "latest-event",
      content: JSON.stringify({
        conversationSuggestions: [{
          question: "오늘도 산책 다녀오셨어요?",
          emphasis: "산책",
          reason: "평소 아침 산책을 하신다고 했어요.",
          sourceCheckEventId: "latest-event",
        }],
        handover: [],
        conversationSummaries: [],
      }),
      updatedAt: new Date("2026-08-23T00:00:00.000Z"),
    });

    const result = await getSubjectBriefing("subject-a");

    expect(result?.conversationSuggestions[0]?.source.checkEventId).toBe(
      "latest-event",
    );
    expect(mocks.generateSubjectBriefing).not.toHaveBeenCalled();
    expect(mocks.briefingUpsert).not.toHaveBeenCalled();
  });

  it("새 기록이면 검증된 결과를 갱신 저장한다", async () => {
    mocks.briefingFindUnique.mockResolvedValue({
      sourceCheckEventId: "older-event",
      content: "{}",
      updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    });
    mocks.generateSubjectBriefing.mockResolvedValue({
      conversationSuggestions: [],
      handover: [{
        category: BriefingCategory.LIFE_RHYTHM,
        text: "아침 산책을 하는 생활 리듬이 있다.",
        sourceCheckEventId: "event-1",
      }],
      conversationSummaries: [],
    });
    mocks.briefingUpsert.mockResolvedValue({
      updatedAt: new Date("2026-08-23T01:00:00.000Z"),
    });

    const result = await getSubjectBriefing("subject-a");

    expect(result?.handover[0]?.source.checkEventId).toBe("latest-event");
    expect(mocks.generateSubjectBriefing).toHaveBeenCalledOnce();
    expect(mocks.briefingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { subjectId: "subject-a" },
        update: expect.objectContaining({
          sourceCheckEventId: "latest-event",
        }),
      }),
    );
  });

  it("모델이 빈 결과를 내도 최신 기록 기준으로 캐시한다", async () => {
    mocks.briefingFindUnique.mockResolvedValue(null);
    mocks.generateSubjectBriefing.mockResolvedValue({
      handover: [],
      conversationSuggestions: [],
      conversationSummaries: [],
    });
    mocks.briefingUpsert.mockResolvedValue({
      updatedAt: new Date("2026-08-23T01:00:00.000Z"),
    });

    const result = await getSubjectBriefing("subject-a");

    expect(result?.handover).toEqual([]);
    expect(mocks.briefingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceCheckEventId: "latest-event",
        }),
      }),
    );
  });
});
