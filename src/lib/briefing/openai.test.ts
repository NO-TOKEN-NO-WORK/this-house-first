import { describe, expect, it, vi } from "vitest";
import {
  BriefingCategory,
  BRIEFING_MAX_LINES,
  CONVERSATION_SUGGESTION_MAX,
  CONVERSATION_SUMMARY_MAX,
} from "../domain";
import { toBriefingModelEvents } from "./privacy";
import {
  BriefingGenerationError,
  generateSubjectBriefing,
  parseUnverifiedBriefing,
} from "./openai";
import type { BriefingSourceEvent } from "./types";

/**
 * 외부로 나가는 요청의 모양이 곧 개인정보 경계다 (ADR-0024).
 * 이 파일은 "무엇이 나가는가"를 고정한다 — 마스킹이나 별칭을 빼먹은 변경이 조용히 지나가지 않게.
 */

const OK_DRAFT = {
  handover: [
    {
      category: BriefingCategory.CAUTION,
      text: "냉방기가 고장 났다고 했다.",
      sourceCheckEventId: "event-2",
    },
  ],
  conversationSuggestions: [],
  conversationSummaries: [],
};

function respondWith(payload: unknown, init: { status?: number } = {}) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(payload), {
        status: init.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

function completedWith(output: unknown) {
  return {
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(output) }],
      },
    ],
  };
}

/** 실제로 나간 요청 본문 — 경계 검사는 전부 이 문자열 위에서 한다 */
function sentBodyOf(fetcher: ReturnType<typeof respondWith>): {
  raw: string;
  json: Record<string, unknown>;
} {
  const call = fetcher.mock.calls[0];
  if (!call) throw new Error("요청이 나가지 않았다");
  const raw = String((call[1] as RequestInit).body);
  return { raw, json: JSON.parse(raw) as Record<string, unknown> };
}

const sourceEvents: BriefingSourceEvent[] = [
  {
    id: "db-check-event-1",
    subjectId: "db-subject-a",
    date: "2026-08-19",
    kind: "전화",
    result: "괜찮았어요",
    memo: "김순자 님 댁은 행복동 중앙로 12-3. 연락은 010-0000-0101",
  },
  {
    id: "db-check-event-2",
    subjectId: "db-subject-a",
    date: "2026-08-20",
    kind: "방문",
    result: "에어컨 없음·고장",
    memo: "선풍기만 있고 에어컨은 없었다.",
  },
];

describe("Luna 맥락 브리핑 생성", () => {
  it("medium·store false·strict schema로 한 대상자의 임시 기록만 보낸다", async () => {
    let sentBody: Record<string, unknown> | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        status: "completed",
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: JSON.stringify({
              handover: [{
                category: BriefingCategory.CAUTION,
                text: "최근 무릎 불편으로 외출이 줄었다고 했다.",
                sourceCheckEventId: "event-1",
              }],
              conversationSuggestions: [{
                question: "다음 진료 때 어떻게 이동하실 예정이에요?",
                emphasis: "어떻게 이동",
                reason: "지난 통화에서 진료 이동을 걱정하셨어요.",
                sourceCheckEventId: "event-1",
              }],
              conversationSummaries: [{
                text: "무릎 불편과 진료 이동 걱정을 이야기했다.",
                sourceCheckEventId: "event-1",
                ongoingItems: [{
                  text: "진료 이동 방법 확인",
                  sourceCheckEventId: "event-1",
                }],
              }],
            }),
          }],
        }],
      }));
    };

    const result = await generateSubjectBriefing(
      [{
        sourceCheckEventId: "event-1",
        date: "2026-08-19",
        kind: "전화",
        result: "괜찮았어요",
        memo: "최근 무릎이 불편해 진료 이동이 걱정된다고 했다.",
      }],
      { apiKey: "test-key", fetcher },
    );

    expect(sentBody).toMatchObject({
      model: "openai/gpt-5.6-luna",
      reasoning: { effort: "medium" },
      store: false,
      text: { format: { type: "json_schema", strict: true } },
    });
    const input = sentBody?.input as Array<{ role: string; content: string }>;
    const userInput = JSON.parse(
      input.find((message) => message.role === "user")?.content ?? "{}",
    ) as Record<string, unknown>;
    expect(userInput).toMatchObject({
      checkEvents: [{ sourceCheckEventId: "event-1" }],
    });
    expect(userInput).not.toHaveProperty("subjectId");
    expect(result.handover[0]?.category).toBe(BriefingCategory.CAUTION);
  });

  it("인증이 없으면 부르지 않는다 — 키 없이 자유 서술이 나가지 않게", async () => {
    const fetcher = respondWith(completedWith(OK_DRAFT));
    const { events } = toBriefingModelEvents(sourceEvents, []);
    await expect(
      generateSubjectBriefing(events, { apiKey: "  ", fetcher }),
    ).rejects.toMatchObject({ code: "MISSING_AI_GATEWAY_AUTH", status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("실제 DB id·이름·전화·주소는 어떤 형태로도 나가지 않는다", async () => {
    const fetcher = respondWith(completedWith(OK_DRAFT));
    const { events } = toBriefingModelEvents(sourceEvents, ["김순자"]);
    await generateSubjectBriefing(events, { apiKey: "k", fetcher });

    const { raw } = sentBodyOf(fetcher);
    for (const secret of [
      "db-check-event-1",
      "db-subject-a",
      "김순자",
      "010-0000-0101",
      "중앙로",
    ]) {
      expect(raw).not.toContain(secret);
    }
    // 기록 식별자는 이 요청 안에서만 뜻이 있는 임시 별칭이다
    expect(raw).toContain("event-1");
  });

  it("산출물 상한을 도메인 상수로 고정한다 — 화면과 스키마가 따로 놀지 않게", async () => {
    const fetcher = respondWith(completedWith(OK_DRAFT));
    const { events } = toBriefingModelEvents(sourceEvents, []);
    await generateSubjectBriefing(events, { apiKey: "k", fetcher });

    const { json } = sentBodyOf(fetcher);
    const schema = (
      json.text as { format: { schema: { properties: Record<string, { maxItems: number }> } } }
    ).format.schema.properties;
    expect(schema.handover.maxItems).toBe(BRIEFING_MAX_LINES);
    expect(schema.conversationSuggestions.maxItems).toBe(
      CONVERSATION_SUGGESTION_MAX,
    );
    expect(schema.conversationSummaries.maxItems).toBe(CONVERSATION_SUMMARY_MAX);
  });

  it("HTTP 오류·미완료 응답은 코드를 붙여 던진다 — 화면은 브리핑만 뺀다", async () => {
    const { events } = toBriefingModelEvents(sourceEvents, []);
    await expect(
      generateSubjectBriefing(events, {
        apiKey: "k",
        fetcher: respondWith({}, { status: 500 }),
      }),
    ).rejects.toBeInstanceOf(BriefingGenerationError);
    await expect(
      generateSubjectBriefing(events, {
        apiKey: "k",
        fetcher: respondWith({ status: "incomplete", output: [] }),
      }),
    ).rejects.toMatchObject({ code: "INCOMPLETE_BRIEFING_RESPONSE" });
  });
});

describe("parseUnverifiedBriefing", () => {
  it("JSON이 아니거나 목록이 없으면 형식 오류다 — 예전 모양의 캐시가 되살아나지 않게", () => {
    expect(() => parseUnverifiedBriefing("not json")).toThrow(
      BriefingGenerationError,
    );
    expect(() => parseUnverifiedBriefing("{}")).toThrow(BriefingGenerationError);
    expect(() =>
      parseUnverifiedBriefing(JSON.stringify({ todayPrompt: null, handover: [] })),
    ).toThrow(BriefingGenerationError);
  });

  it("근거가 빠진 문장은 형식 오류로 잡는다", () => {
    expect(() =>
      parseUnverifiedBriefing(
        JSON.stringify({
          handover: [{ category: "CAUTION", text: "근거가 없다" }],
          conversationSuggestions: [],
          conversationSummaries: [],
        }),
      ),
    ).toThrow(BriefingGenerationError);
  });
});
