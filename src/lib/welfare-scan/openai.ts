import {
  WelfareIssue,
  type WelfareSignal,
  type WelfareSubjectProfile,
} from "./eligibility";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const ALLOWED_ISSUES = new Set<string>(Object.values(WelfareIssue));

export class OpenAIWelfareError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "OpenAIWelfareError";
  }
}

function outputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as {
    status?: unknown;
    output?: Array<{
      type?: unknown;
      content?: Array<{ type?: unknown; text?: unknown; refusal?: unknown }>;
    }>;
  };
  if (response.status !== "completed" || !Array.isArray(response.output)) return null;
  for (const item of response.output) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content.type === "refusal") {
        throw new OpenAIWelfareError(
          "AI가 해당 메모 분석 요청을 처리하지 않았습니다.",
          "OPENAI_REFUSAL",
        );
      }
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return null;
}

function parseSignals(
  text: string,
  profilesByAlias: Map<string, WelfareSubjectProfile>,
): WelfareSignal[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new OpenAIWelfareError(
      "AI 분석 결과를 JSON으로 해석하지 못했습니다.",
      "INVALID_OPENAI_RESPONSE",
    );
  }
  const signals = (parsed as { signals?: unknown })?.signals;
  if (!Array.isArray(signals)) {
    throw new OpenAIWelfareError(
      "AI 분석 결과에 대상자 목록이 없습니다.",
      "INVALID_OPENAI_RESPONSE",
    );
  }
  return signals.map((signal) => {
    if (!signal || typeof signal !== "object") {
      throw new OpenAIWelfareError(
        "AI 분석 결과의 대상자 형식이 올바르지 않습니다.",
        "INVALID_OPENAI_RESPONSE",
      );
    }
    const value = signal as Record<string, unknown>;
    if (
      typeof value.subjectId !== "string" ||
      !profilesByAlias.has(value.subjectId) ||
      !Array.isArray(value.issues) ||
      value.issues.some((issue) => typeof issue !== "string" || !ALLOWED_ISSUES.has(issue))
    ) {
      throw new OpenAIWelfareError(
        "AI 분석 결과가 허용된 문제 코드와 맞지 않습니다.",
        "INVALID_OPENAI_RESPONSE",
      );
    }
    const profile = profilesByAlias.get(value.subjectId)!;
    const hasCoolingIssue = profile.hasAircon === false || profile.airconBroken;
    const issues = (value.issues as WelfareSignal["issues"]).filter(
      (issue) => issue === WelfareIssue.COOLING_ISSUE && hasCoolingIssue,
    );
    return {
      subjectId: profile.subjectId,
      issues,
      evidence: issues.length === 0
        ? []
        : [
            ...(profile.hasAircon === false ? ["냉방기기 없음 기록"] : []),
            ...(profile.airconBroken ? ["냉방기기 고장 기록"] : []),
          ],
    };
  });
}

export async function extractWelfareSignals(
  profiles: WelfareSubjectProfile[],
  options: { apiKey?: string; fetcher?: typeof fetch } = {},
): Promise<WelfareSignal[]> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  if (!apiKey.trim()) {
    throw new OpenAIWelfareError(
      "OPENAI_API_KEY 환경변수가 설정되지 않았습니다.",
      "MISSING_OPENAI_API_KEY",
      503,
    );
  }
  const fetcher = options.fetcher ?? fetch;
  const profilesByAlias = new Map(
    profiles.map((profile, index) => [`scan-${index + 1}`, profile]),
  );
  let response: Response;
  try {
    response = await fetcher(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        reasoning: { effort: "high" },
        store: false,
        max_output_tokens: 4_000,
        input: [
          {
            role: "system",
            content:
              "당신은 제공된 구조화 사실에서 지원이 필요한 생활 문제만 분류합니다. 수급 자격이나 선정 여부는 판단하지 말고, 제공되지 않은 문제는 만들지 마세요.",
          },
          {
            role: "user",
            content: JSON.stringify(
              profiles.map((profile, index) => ({
                subjectId: `scan-${index + 1}`,
                age: profile.age,
                livesAlone: profile.livesAlone,
                hasAircon: profile.hasAircon,
                airconBroken: profile.airconBroken,
              })),
            ),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "welfare_signals",
            strict: true,
            schema: {
              type: "object",
              properties: {
                signals: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      subjectId: { type: "string" },
                      issues: {
                        type: "array",
                        items: { type: "string", enum: Object.values(WelfareIssue) },
                      },
                    },
                    required: ["subjectId", "issues"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["signals"],
              additionalProperties: false,
            },
          },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    throw new OpenAIWelfareError(
      error instanceof Error && error.name === "TimeoutError"
        ? "AI 분석 응답 시간이 초과되었습니다."
        : "AI 분석 서비스에 연결하지 못했습니다.",
      "OPENAI_UNAVAILABLE",
    );
  }

  if (!response.ok) {
    throw new OpenAIWelfareError(
      `AI 분석 서비스가 HTTP ${response.status}로 응답했습니다.`,
      "OPENAI_HTTP_ERROR",
      response.status === 401 ? 503 : 502,
    );
  }
  const payload: unknown = await response.json();
  const text = outputText(payload);
  if (!text) {
    throw new OpenAIWelfareError(
      "AI 분석이 완료되지 않았습니다.",
      "INCOMPLETE_OPENAI_RESPONSE",
    );
  }
  return parseSignals(text, profilesByAlias);
}
