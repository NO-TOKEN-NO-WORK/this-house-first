import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CallResult, CheckKind } from "@/lib/domain";
import type { BriefingConversationSuggestion } from "@/lib/briefing/types";
import { ConversationSuggestions } from "./ConversationSuggestions";

const suggestion: BriefingConversationSuggestion = {
  question: "오늘 오전 혈압약은 챙겨 드셨어요?",
  emphasis: "오전 혈압약",
  reason: "최근에도 복약을 잘 이어가고 있는지 확인해요.",
  source: {
    checkEventId: "check-1",
    date: "2026-08-14",
    dateLabel: "8/14 (금)",
    kind: CheckKind.CALL,
    kindLabel: "전화",
    result: CallResult.OK,
    resultLabel: "괜찮았어요",
    label: "8/14 (금) 전화 · 괜찮았어요",
  },
};

describe("ConversationSuggestions", () => {
  it("추천이 없으면 묶음을 그리지 않는다", () => {
    expect(
      renderToStaticMarkup(<ConversationSuggestions suggestions={[]} />),
    ).toBe("");
  });

  it("질문·이유·서버가 만든 근거를 함께 보여 준다", () => {
    const html = renderToStaticMarkup(
      <ConversationSuggestions suggestions={[suggestion]} />,
    );

    expect(html).toContain("AI 대화 추천");
    expect(html).toContain("최근에도 복약을 잘 이어가고 있는지 확인해요.");
    expect(html).toContain("근거 · 8/14 (금) 전화 · 괜찮았어요");
    expect(html).toContain('<strong class="font-bold">오전 혈압약</strong>');
  });

  it("강조가 없으면 질문을 그대로 둔다 — UI가 문장을 다시 쓰지 않는다", () => {
    const html = renderToStaticMarkup(
      <ConversationSuggestions suggestions={[{ ...suggestion, emphasis: null }]} />,
    );

    expect(html).not.toContain("<strong");
    expect(html.replace(/<[^>]+>/g, "")).toContain(suggestion.question);
  });

  it("추천마다 질문·이유·근거 세 줄이 짝을 이룬다", () => {
    const html = renderToStaticMarkup(
      <ConversationSuggestions
        suggestions={[
          suggestion,
          { ...suggestion, question: "요즘 식사는 어떠세요?", emphasis: null },
        ]}
      />,
    );

    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html.match(/근거 ·/g)).toHaveLength(2);
  });

  it("배지 글자색은 대비 때문에 Figma의 warning 대신 warning-strong이다", () => {
    const html = renderToStaticMarkup(
      <ConversationSuggestions suggestions={[suggestion]} />,
    );
    expect(html).toContain("text-status-warning-strong");
  });
});
