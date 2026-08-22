import { beforeEach, describe, expect, it, vi } from "vitest";
import { BriefingCategory, CallResult, CheckKind } from "../domain";
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

import { getSubjectBriefing } from "./service";

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
