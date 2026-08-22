import { BriefingCategory } from "../domain";
import type {
  BriefingModelEvent,
  UnverifiedBriefingStatement,
  UnverifiedSubjectBriefing,
} from "./types";

const AI_GATEWAY_RESPONSES_URL = "https://ai-gateway.vercel.sh/v1/responses";

export class BriefingGenerationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "BriefingGenerationError";
  }
}

function outputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as {
    status?: unknown;
    output?: Array<{
      type?: unknown;
      content?: Array<{ type?: unknown; text?: unknown }>;
    }>;
  };
  if (response.status !== "completed" || !Array.isArray(response.output)) {
    return null;
  }
  for (const item of response.output) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content.type === "refusal") {
        throw new BriefingGenerationError(
          "맥락 브리핑 생성 요청이 거절되었습니다.",
          "BRIEFING_REFUSAL",
        );
      }
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return null;
}

function parseStatement(value: unknown): UnverifiedBriefingStatement | null {
  if (!value || typeof value !== "object") return null;
  const statement = value as Record<string, unknown>;
  if (
    typeof statement.text !== "string" ||
    typeof statement.sourceCheckEventId !== "string"
  ) {
    return null;
  }
  return {
    text: statement.text,
    sourceCheckEventId: statement.sourceCheckEventId,
  };
}

export function parseUnverifiedBriefing(text: string): UnverifiedSubjectBriefing {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BriefingGenerationError(
      "맥락 브리핑 결과를 JSON으로 해석하지 못했습니다.",
      "INVALID_BRIEFING_RESPONSE",
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new BriefingGenerationError(
      "맥락 브리핑 결과 형식이 올바르지 않습니다.",
      "INVALID_BRIEFING_RESPONSE",
    );
  }
  const value = parsed as Record<string, unknown>;
  if (
    !Array.isArray(value.handover) ||
    !Array.isArray(value.conversationSummaries)
  ) {
    throw new BriefingGenerationError(
      "맥락 브리핑 결과 목록이 없습니다.",
      "INVALID_BRIEFING_RESPONSE",
    );
  }
  const todayPrompt = value.todayPrompt === null
    ? null
    : parseStatement(value.todayPrompt);
  if (value.todayPrompt !== null && !todayPrompt) {
    throw new BriefingGenerationError(
      "오늘 확인할 것의 형식이 올바르지 않습니다.",
      "INVALID_BRIEFING_RESPONSE",
    );
  }

  const handover = value.handover.map((item) => {
    const statement = parseStatement(item);
    const category = item && typeof item === "object"
      ? (item as Record<string, unknown>).category
      : null;
    if (!statement || typeof category !== "string") {
      throw new BriefingGenerationError(
        "인수인계 문장의 형식이 올바르지 않습니다.",
        "INVALID_BRIEFING_RESPONSE",
      );
    }
    return { ...statement, category };
  });

  const conversationSummaries = value.conversationSummaries.map((item) => {
    const statement = parseStatement(item);
    const ongoingItems = item && typeof item === "object"
      ? (item as Record<string, unknown>).ongoingItems
      : null;
    if (
      !statement ||
      !Array.isArray(ongoingItems) ||
      ongoingItems.some((entry) => parseStatement(entry) === null)
    ) {
      throw new BriefingGenerationError(
        "대화 요약의 형식이 올바르지 않습니다.",
        "INVALID_BRIEFING_RESPONSE",
      );
    }
    return {
      ...statement,
      ongoingItems: ongoingItems.map((entry) => parseStatement(entry)!),
    };
  });

  return { todayPrompt, handover, conversationSummaries };
}

export async function generateSubjectBriefing(
  events: BriefingModelEvent[],
  options: { apiKey?: string; fetcher?: typeof fetch } = {},
): Promise<UnverifiedSubjectBriefing> {
  const apiKey = options.apiKey ??
    process.env.AI_GATEWAY_API_KEY ??
    process.env.VERCEL_OIDC_TOKEN ??
    "";
  if (!apiKey.trim()) {
    throw new BriefingGenerationError(
      "Vercel AI Gateway 인증이 설정되지 않았습니다.",
      "MISSING_AI_GATEWAY_AUTH",
      503,
    );
  }

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(AI_GATEWAY_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-luna",
        reasoning: { effort: "medium" },
        store: false,
        max_output_tokens: 4_000,
        input: [
          {
            type: "message",
            role: "system",
            content: [
              "당신은 생활지원사가 다음 만남 전에 확인할 생활 맥락만 정리합니다.",
              "위험도, 우선순위, 의료 판단, 처방, 복지 수급 자격은 판단하지 마세요.",
              "모든 문장은 반드시 제공된 기록 하나의 sourceCheckEventId를 인용해야 합니다.",
              "근거가 약하면 문장을 만들지 말고 빈 배열이나 null을 반환하세요.",
              "handover는 최대 3개이며 LIFE_RHYTHM, REPEATED_SIGNAL, CAUTION 분류를 사용하세요.",
              "conversationSummaries는 최근 기록별 대화 핵심과 아직 확인할 사항만 간결하게 정리하세요.",
            ].join(" "),
          },
          {
            type: "message",
            role: "user",
            content: JSON.stringify({ subjectId: "brief-1", checkEvents: events }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "subject_context_briefing",
            strict: true,
            schema: {
              type: "object",
              properties: {
                todayPrompt: {
                  anyOf: [
                    {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        sourceCheckEventId: { type: "string" },
                      },
                      required: ["text", "sourceCheckEventId"],
                      additionalProperties: false,
                    },
                    { type: "null" },
                  ],
                },
                handover: {
                  type: "array",
                  maxItems: 3,
                  items: {
                    type: "object",
                    properties: {
                      category: {
                        type: "string",
                        enum: Object.values(BriefingCategory),
                      },
                      text: { type: "string" },
                      sourceCheckEventId: { type: "string" },
                    },
                    required: ["category", "text", "sourceCheckEventId"],
                    additionalProperties: false,
                  },
                },
                conversationSummaries: {
                  type: "array",
                  maxItems: 3,
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      sourceCheckEventId: { type: "string" },
                      ongoingItems: {
                        type: "array",
                        maxItems: 3,
                        items: {
                          type: "object",
                          properties: {
                            text: { type: "string" },
                            sourceCheckEventId: { type: "string" },
                          },
                          required: ["text", "sourceCheckEventId"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["text", "sourceCheckEventId", "ongoingItems"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["todayPrompt", "handover", "conversationSummaries"],
              additionalProperties: false,
            },
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new BriefingGenerationError(
      error instanceof Error && error.name === "TimeoutError"
        ? "맥락 브리핑 응답 시간이 초과되었습니다."
        : "맥락 브리핑 서비스에 연결하지 못했습니다.",
      "BRIEFING_UNAVAILABLE",
    );
  }

  if (!response.ok) {
    throw new BriefingGenerationError(
      `맥락 브리핑 서비스가 HTTP ${response.status}로 응답했습니다.`,
      "BRIEFING_HTTP_ERROR",
      response.status === 401 ? 503 : 502,
    );
  }
  const payload: unknown = await response.json();
  const text = outputText(payload);
  if (!text) {
    throw new BriefingGenerationError(
      "맥락 브리핑 생성이 완료되지 않았습니다.",
      "INCOMPLETE_BRIEFING_RESPONSE",
    );
  }
  return parseUnverifiedBriefing(text);
}
