import {
  WelfareIssue,
  type WelfareSignal,
  type WelfareSubjectProfile,
} from "./eligibility";

const AI_GATEWAY_RESPONSES_URL = "https://ai-gateway.vercel.sh/v1/responses";
const ALLOWED_ISSUES = new Set<string>(Object.values(WelfareIssue));
const SAFE_MEMO_TERMS: Record<WelfareIssue, readonly string[]> = {
  [WelfareIssue.COOLING_ISSUE]: ["에어컨", "냉방기", "선풍기", "냉방", "더위", "미지근", "시원하지"],
  [WelfareIssue.ENERGY_COST]: ["전기세", "전기요금", "관리비", "가스비", "난방비", "요금"],
  [WelfareIssue.MOBILITY]: ["거동", "보행", "계단", "휠체어", "지팡이", "외출", "이동"],
  [WelfareIssue.SAFETY_EQUIPMENT]: ["화재", "감지기", "응급벨", "가스누출", "안전손잡이", "미끄럼"],
  [WelfareIssue.HOUSING_REPAIR]: ["누수", "곰팡이", "단열", "창호", "도배", "보일러", "지붕", "수선"],
};
const SAFE_CONTEXT_TERMS = ["고장", "없음", "불편", "부담", "필요"] as const;
const ISSUE_EVIDENCE_LABEL: Record<WelfareIssue, string> = {
  [WelfareIssue.COOLING_ISSUE]: "냉방 설비 관련 표현",
  [WelfareIssue.ENERGY_COST]: "에너지 비용 관련 표현",
  [WelfareIssue.MOBILITY]: "거동 관련 표현",
  [WelfareIssue.SAFETY_EQUIPMENT]: "안전 설비 관련 표현",
  [WelfareIssue.HOUSING_REPAIR]: "주거 수선 관련 표현",
};

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

function extractSafeMemoTerms(memo: string | null): string[] {
  const words = memo?.match(/[가-힣]+/g) ?? [];
  const allowedTerms = [...Object.values(SAFE_MEMO_TERMS).flat(), ...SAFE_CONTEXT_TERMS];
  return [...new Set(allowedTerms.filter((term) => words.some((word) => word.includes(term))))];
}

function parseSignals(
  text: string,
  profilesByAlias: Map<
    string,
    { profile: WelfareSubjectProfile; fieldRecordTerms: string[] }
  >,
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
    const { profile, fieldRecordTerms } = profilesByAlias.get(value.subjectId)!;
    const hasCoolingIssue = profile.hasAircon === false || profile.airconBroken;
    const memoIssues = (value.issues as WelfareSignal["issues"]).filter(
      (issue) => SAFE_MEMO_TERMS[issue].some((term) => fieldRecordTerms.includes(term)),
    );
    const issues = [
      ...(hasCoolingIssue ? [WelfareIssue.COOLING_ISSUE] : []),
      ...memoIssues,
    ].filter((issue, index, values) => values.indexOf(issue) === index);
    return {
      subjectId: profile.subjectId,
      issues,
      evidence: [
        ...(profile.hasAircon === false ? ["냉방기기 없음 기록"] : []),
        ...(profile.airconBroken ? ["냉방기기 고장 기록"] : []),
        ...memoIssues.map((issue) => `현장 기록에서 ${ISSUE_EVIDENCE_LABEL[issue]} 감지`),
      ],
    };
  });
}

export async function extractWelfareSignals(
  profiles: WelfareSubjectProfile[],
  options: { apiKey?: string; fetcher?: typeof fetch } = {},
): Promise<WelfareSignal[]> {
  const apiKey = options.apiKey ??
    process.env.AI_GATEWAY_API_KEY ??
    process.env.VERCEL_OIDC_TOKEN ??
    "";
  if (!apiKey.trim()) {
    throw new OpenAIWelfareError(
      "Vercel AI Gateway 인증이 설정되지 않았습니다.",
      "MISSING_AI_GATEWAY_AUTH",
      503,
    );
  }
  const fetcher = options.fetcher ?? fetch;
  const profilesByAlias = new Map(
    profiles.map((profile, index) => [
      `scan-${index + 1}`,
      { profile, fieldRecordTerms: extractSafeMemoTerms(profile.latestMemo) },
    ] as const),
  );
  let response: Response;
  try {
    response = await fetcher(AI_GATEWAY_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-luna",
        reasoning: { effort: "high" },
        store: false,
        max_output_tokens: 4_000,
        input: [
          {
            role: "system",
            content:
              "당신은 제공된 구조화 사실과 개인정보를 제거한 현장 기록 용어에서 지원이 필요한 생활 문제만 분류합니다. 수급 자격이나 선정 여부는 판단하지 말고, 제공되지 않은 문제는 만들지 마세요.",
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
                fieldRecordTerms: extractSafeMemoTerms(profile.latestMemo),
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
