import { describe, expect, it } from "vitest";
import { extractWelfareSignals } from "./openai";

describe("Luna 복지 메모 분석", () => {
  const profiles = [
    {
      subjectId: "database-subject-987",
      name: "김○○",
      age: 88,
      livesAlone: true,
      hasAircon: false,
      airconBroken: true,
      workerName: "이미경",
      latestMemo: "홍길동이 02-123-4567로 연락했고 서울시 종로구 세종대로 1에 삽니다. 전기세 부담, 거동 불편, 화재 감지기와 누수 수선이 필요합니다.",
    },
  ];

  it("Vercel AI Gateway의 Luna high에 임시 ID와 구조화 설비 사실만 보낸다", async () => {
    let requestedUrl = "";
    let authorization = "";
    let sentBody: Record<string, unknown> | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      requestedUrl = String(input);
      authorization = new Headers(init?.headers).get("Authorization") ?? "";
      sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    signals: [
                      {
                        subjectId: "scan-1",
                        issues: [
                          "COOLING_ISSUE",
                          "ENERGY_COST",
                          "MOBILITY",
                          "SAFETY_EQUIPMENT",
                          "HOUSING_REPAIR",
                        ],
                        evidence: ["홍길동, 02-123-4567"],
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
      );
    };

    const result = await extractWelfareSignals(profiles, {
      apiKey: "gateway-test-key",
      fetcher,
    });

    expect(requestedUrl).toBe("https://ai-gateway.vercel.sh/v1/responses");
    expect(authorization).toBe("Bearer gateway-test-key");
    expect(sentBody).toMatchObject({
      model: "openai/gpt-5.6-luna",
      reasoning: { effort: "high" },
      store: false,
      input: [
        { type: "message", role: "system" },
        { type: "message", role: "user" },
      ],
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(JSON.stringify(sentBody)).not.toContain("이미경");
    expect(JSON.stringify(sentBody)).not.toContain("database-subject-987");
    expect(JSON.stringify(sentBody)).not.toContain("홍길동");
    expect(JSON.stringify(sentBody)).not.toContain("02-123-4567");
    expect(JSON.stringify(sentBody)).not.toContain("서울시 종로구 세종대로 1");
    expect(JSON.stringify(sentBody)).not.toContain("latestMemo");
    expect(JSON.stringify(sentBody)).toContain("fieldRecordTerms");
    expect(JSON.stringify(sentBody)).toContain("전기세");
    expect(JSON.stringify(sentBody)).toContain("거동");
    expect(result).toEqual([
      {
        subjectId: "database-subject-987",
        issues: [
          "COOLING_ISSUE",
          "ENERGY_COST",
          "MOBILITY",
          "SAFETY_EQUIPMENT",
          "HOUSING_REPAIR",
        ],
        evidence: expect.arrayContaining([
          "냉방기기 없음 기록",
          "냉방기기 고장 기록",
          "현장 기록에서 에너지 비용 관련 표현 감지",
          "현장 기록에서 거동 관련 표현 감지",
          "현장 기록에서 안전 설비 관련 표현 감지",
          "현장 기록에서 주거 수선 관련 표현 감지",
        ]),
      },
    ]);
  });

  it("Vercel 배포에서는 자동 OIDC 토큰으로 Gateway를 인증한다", async () => {
    const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;
    const originalOidcToken = process.env.VERCEL_OIDC_TOKEN;
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.VERCEL_OIDC_TOKEN = "vercel-oidc-token";
    let authorization = "";

    try {
      const fetcher: typeof fetch = async (_input, init) => {
        authorization = new Headers(init?.headers).get("Authorization") ?? "";
        return new Response(JSON.stringify({
          status: "completed",
          output: [{
            type: "message",
            content: [{
              type: "output_text",
              text: JSON.stringify({ signals: [{ subjectId: "scan-1", issues: [] }] }),
            }],
          }],
        }));
      };

      await extractWelfareSignals(profiles, { fetcher });

      expect(authorization).toBe("Bearer vercel-oidc-token");
    } finally {
      if (originalGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
      else process.env.AI_GATEWAY_API_KEY = originalGatewayKey;
      if (originalOidcToken === undefined) delete process.env.VERCEL_OIDC_TOKEN;
      else process.env.VERCEL_OIDC_TOKEN = originalOidcToken;
      if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  it("모델이 빠뜨려도 구조화 설비 문제는 유지한다", async () => {
    const fetcher: typeof fetch = async () => new Response(
      JSON.stringify({
        status: "completed",
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: JSON.stringify({ signals: [{ subjectId: "scan-1", issues: [] }] }),
          }],
        }],
      }),
    );

    const [result] = await extractWelfareSignals(profiles, { apiKey: "test-key", fetcher });

    expect(result).toMatchObject({
      issues: ["COOLING_ISSUE"],
      evidence: ["냉방기기 없음 기록", "냉방기기 고장 기록"],
    });
  });

  it("Gateway 인증이 없으면 연결 실패 상태로 분류할 수 있는 오류를 낸다", async () => {
    await expect(
      extractWelfareSignals(profiles, { apiKey: "" }),
    ).rejects.toMatchObject({
      code: "MISSING_AI_GATEWAY_AUTH",
      status: 503,
    });
  });
});
