import { describe, expect, it } from "vitest";
import {
  BriefingCategory,
  CallResult,
  CheckKind,
  VisitResult,
} from "../domain";
import {
  evidenceOf,
  isEmptyBriefing,
  toStoredBriefing,
  verifySubjectBriefing,
} from "./evidence";
import type { BriefingSourceEvent, UnverifiedSubjectBriefing } from "./types";

/**
 * 근거 대조는 이 기능의 안전장치다 (ADR-0024 경계 2).
 * 모델이 없는 기록을 인용하거나 남의 기록을 끌어오면 그 문장은 화면에 닿지 못해야 한다.
 * DB를 모르는 순수 함수라 prisma 목 없이 그대로 검사한다.
 */

const sourceEvents: BriefingSourceEvent[] = [
  {
    id: "subject-a-call",
    subjectId: "subject-a",
    date: "2026-08-19",
    kind: CheckKind.CALL,
    result: CallResult.OK,
    memo: "무릎이 불편하다고 했다.",
  },
  {
    id: "subject-a-visit",
    subjectId: "subject-a",
    date: "2026-08-20",
    kind: CheckKind.VISIT,
    result: VisitResult.AIRCON_ISSUE,
    memo: "냉방기가 작동하지 않았다.",
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

const aliases = new Map([
  ["event-1", "subject-a-call"],
  ["event-2", "subject-a-visit"],
  ["event-3", "subject-b-visit"],
]);

const empty: UnverifiedSubjectBriefing = {
  handover: [],
  conversationSuggestions: [],
  conversationSummaries: [],
};

function verify(output: Partial<UnverifiedSubjectBriefing>) {
  return verifySubjectBriefing({
    subjectId: "subject-a",
    output: { ...empty, ...output },
    sourceIdByAlias: aliases,
    sourceEvents,
    generatedAt: new Date("2026-08-23T00:00:00.000Z"),
  });
}

describe("evidenceOf", () => {
  it("근거 문구를 DB 행과 도메인 상수에서 만든다 — 모델 출력이 아니다", () => {
    expect(evidenceOf(sourceEvents[1]!)).toEqual({
      checkEventId: "subject-a-visit",
      date: "2026-08-20",
      dateLabel: "8/20 (목)",
      kind: CheckKind.VISIT,
      kindLabel: "방문",
      result: VisitResult.AIRCON_ISSUE,
      resultLabel: "에어컨 없음·고장",
      label: "8/20 방문 · 에어컨 없음·고장",
    });
  });

  it("도메인 밖 결과값은 근거로 쓰지 않는다 — DB 컬럼이 String이라 여기가 방어선이다", () => {
    expect(evidenceOf({ ...sourceEvents[0]!, result: "MADE_UP" })).toBeNull();
    expect(evidenceOf({ ...sourceEvents[0]!, kind: "SMS" })).toBeNull();
  });
});

describe("verifySubjectBriefing", () => {
  it("남의 기록을 인용한 문장은 버린다", () => {
    const result = verify({
      handover: [
        {
          category: BriefingCategory.LIFE_RHYTHM,
          text: "새벽에 밭에 나가십니다",
          sourceCheckEventId: "event-1",
        },
        {
          category: BriefingCategory.CAUTION,
          text: "다른 대상자의 이야기",
          sourceCheckEventId: "event-3",
        },
      ],
    });

    expect(result.handover).toHaveLength(1);
    expect(result.handover[0]!.source.checkEventId).toBe("subject-a-call");
    expect(JSON.stringify(result)).not.toContain("다른 대상자");
  });

  it("실재하지 않는 별칭을 인용한 문장도 버린다", () => {
    const result = verify({
      handover: [
        {
          category: BriefingCategory.CAUTION,
          text: "지어낸 이야기",
          sourceCheckEventId: "event-99",
        },
      ],
    });
    expect(isEmptyBriefing(result)).toBe(true);
  });

  it("줄 이름은 도메인 상수를 그대로 쓴다", () => {
    const result = verify({
      handover: [
        {
          category: BriefingCategory.CAUTION,
          text: "냉방기가 고장 났습니다",
          sourceCheckEventId: "event-2",
        },
      ],
    });
    expect(result.handover[0]!.categoryLabel).toBe("조심할 것");
  });

  it("알 수 없는 분류는 버린다 — 모델이 축을 새로 만들 수 없다", () => {
    expect(
      verify({
        handover: [
          {
            category: "MOOD",
            text: "기분이 좋아 보이심",
            sourceCheckEventId: "event-1",
          },
        ],
      }).handover,
    ).toEqual([]);
  });

  it("같은 축은 하나만 남기고 도메인 순서로 정렬한다 — 열 때마다 자리가 바뀌지 않게", () => {
    const result = verify({
      handover: [
        {
          category: BriefingCategory.CAUTION,
          text: "냉방기가 고장 났습니다",
          sourceCheckEventId: "event-2",
        },
        {
          category: BriefingCategory.CAUTION,
          text: "두 번째 조심할 것",
          sourceCheckEventId: "event-2",
        },
        {
          category: BriefingCategory.LIFE_RHYTHM,
          text: "새벽에 밭에 나가십니다",
          sourceCheckEventId: "event-1",
        },
      ],
    });
    expect(result.handover.map((item) => item.category)).toEqual([
      BriefingCategory.LIFE_RHYTHM,
      BriefingCategory.CAUTION,
    ]);
  });

  it("빈 문장은 줄로 세지 않는다 — 빈 브리핑이 정상 상태다", () => {
    expect(
      verify({
        handover: [
          {
            category: BriefingCategory.LIFE_RHYTHM,
            text: "   ",
            sourceCheckEventId: "event-1",
          },
        ],
      }).handover,
    ).toEqual([]);
  });

  const suggestion = {
    question: "오늘 오전 혈압약은 챙겨 드셨어요?",
    emphasis: "오전 혈압약",
    reason: "최근에도 복약을 잘 이어가고 있는지 확인해요",
    sourceCheckEventId: "event-1",
  };

  it("대화 추천도 같은 대조를 통과해야 한다", () => {
    expect(
      verify({
        conversationSuggestions: [
          { ...suggestion, sourceCheckEventId: "event-3" },
        ],
      }).conversationSuggestions,
    ).toEqual([]);
  });

  it("질문에 없는 강조 구절은 버린다 — UI가 문장을 다시 쓰지 않기 위해서다", () => {
    const [kept] = verify({
      conversationSuggestions: [{ ...suggestion, emphasis: "당뇨약" }],
    }).conversationSuggestions;
    expect(kept!.emphasis).toBeNull();
  });

  it("질문에 있는 강조 구절은 그대로 살린다", () => {
    const [kept] = verify({
      conversationSuggestions: [suggestion],
    }).conversationSuggestions;
    expect(kept!.emphasis).toBe("오전 혈압약");
    expect(kept!.source.label).toBe("8/19 전화 · 괜찮았어요");
  });

  it("대화 추천은 도메인 상한(2개)까지만 싣는다", () => {
    expect(
      verify({
        conversationSuggestions: [
          suggestion,
          { ...suggestion, question: "두 번째 질문" },
          { ...suggestion, question: "세 번째 질문" },
        ],
      }).conversationSuggestions,
    ).toHaveLength(2);
  });

  it("같은 질문이 두 번 오면 하나만 남긴다", () => {
    expect(
      verify({
        conversationSuggestions: [suggestion, { ...suggestion }],
      }).conversationSuggestions,
    ).toHaveLength(1);
  });

  it("대화 요약은 기록 한 건당 하나이고 진행 중인 사항도 같은 대조를 받는다", () => {
    const result = verify({
      conversationSummaries: [
        {
          text: "무릎 이야기를 하셨어요",
          sourceCheckEventId: "event-1",
          ongoingItems: [
            { text: "다음 통화에서 상태 확인", sourceCheckEventId: "event-1" },
            { text: "남의 기록 인용", sourceCheckEventId: "event-3" },
          ],
        },
        {
          text: "같은 기록의 두 번째 요약",
          sourceCheckEventId: "event-1",
          ongoingItems: [],
        },
      ],
    });

    expect(result.conversationSummaries).toHaveLength(1);
    expect(result.conversationSummaries[0]!.ongoingItems).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("남의 기록");
  });
});

describe("toStoredBriefing", () => {
  it("저장 모양에는 근거 문구가 없다 — 읽을 때 DB 행에서 다시 만든다", () => {
    const view = verify({
      handover: [
        {
          category: BriefingCategory.CAUTION,
          text: "냉방기가 고장 났습니다",
          sourceCheckEventId: "event-2",
        },
      ],
      conversationSuggestions: [
        {
          question: "오늘 오전 혈압약은 챙겨 드셨어요?",
          emphasis: "오전 혈압약",
          reason: "복약을 이어가고 있는지 확인해요",
          sourceCheckEventId: "event-1",
        },
      ],
    });
    const stored = toStoredBriefing(view);

    expect(JSON.stringify(stored)).not.toContain("전화 · 괜찮았어요");
    expect(stored.handover[0]).toEqual({
      category: BriefingCategory.CAUTION,
      text: "냉방기가 고장 났습니다",
      sourceCheckEventId: "subject-a-visit",
    });
    expect(stored.conversationSuggestions[0]!.emphasis).toBe("오전 혈압약");
  });

  it("대조를 통과한 문장만 담긴다 — 버려진 문장이 캐시로 되살아나지 않는다", () => {
    const stored = toStoredBriefing(
      verify({
        handover: [
          {
            category: BriefingCategory.CAUTION,
            text: "남의 기록을 인용한 문장",
            sourceCheckEventId: "event-3",
          },
        ],
      }),
    );
    expect(stored.handover).toEqual([]);
  });
});
