import { describe, expect, it } from "vitest";
import { BriefingCategory } from "../domain";
import { generateSubjectBriefing } from "./openai";

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
              todayPrompt: {
                text: "다음 진료 이동 방법을 확인해 주세요.",
                sourceCheckEventId: "event-1",
              },
              handover: [{
                category: BriefingCategory.CAUTION,
                text: "최근 무릎 불편으로 외출이 줄었다고 했다.",
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
      subjectId: "brief-1",
      checkEvents: [{ sourceCheckEventId: "event-1" }],
    });
    expect(result.handover[0]?.category).toBe(BriefingCategory.CAUTION);
  });
});
