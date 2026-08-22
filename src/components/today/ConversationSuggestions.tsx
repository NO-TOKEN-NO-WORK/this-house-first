import type { BriefingConversationSuggestion } from "@/lib/briefing/types";
import { SUBJECT_INFORMATION_LABELS } from "@/lib/domain";

/** 고정 질문 아래에 붙는 대상자별 대화 추천 — 문장과 근거를 재작성하지 않는다 (ADR-0024). */
export function ConversationSuggestions({
  suggestions,
}: {
  suggestions: readonly BriefingConversationSuggestion[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 border-t border-border-subtle pt-4">
      <h3 className="self-start rounded-sm bg-status-warning-subtle px-2.5 py-2 text-label-15 text-status-warning-strong">
        {SUBJECT_INFORMATION_LABELS.CONVERSATION_SUGGESTIONS}
      </h3>
      <ul className="flex flex-col gap-4">
        {suggestions.map((suggestion) => (
          <li
            key={`${suggestion.source.checkEventId}-${suggestion.question}`}
            className="flex flex-col gap-1"
          >
            <p className="text-body-16 text-text-primary">
              <EmphasizedQuestion
                question={suggestion.question}
                emphasis={suggestion.emphasis}
              />
            </p>
            <p className="text-body-15 text-text-secondary">
              <span aria-hidden>→ </span>
              {suggestion.reason}
            </p>
            <p className="text-body-14 text-text-tertiary">
              {SUBJECT_INFORMATION_LABELS.EVIDENCE} · {suggestion.source.label}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmphasizedQuestion({
  question,
  emphasis,
}: {
  question: string;
  emphasis: string | null;
}) {
  if (!emphasis) return question;
  const start = question.indexOf(emphasis);
  if (start < 0) return question;
  const end = start + emphasis.length;
  return (
    <>
      {question.slice(0, start)}
      <strong className="font-bold">{question.slice(start, end)}</strong>
      {question.slice(end)}
    </>
  );
}
