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

  it("gpt-5.6-luna high에 임시 ID와 구조화 설비 사실만 보낸다", async () => {
    let sentBody: Record<string, unknown> | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
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
      apiKey: "test-key",
      fetcher,
    });

    expect(sentBody).toMatchObject({
      model: "gpt-5.6-luna",
      reasoning: { effort: "high" },
      store: false,
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

  it("서버 API 키가 없으면 연결 실패 상태로 분류할 수 있는 오류를 낸다", async () => {
    await expect(
      extractWelfareSignals(profiles, { apiKey: "" }),
    ).rejects.toMatchObject({
      code: "MISSING_OPENAI_API_KEY",
      status: 503,
    });
  });
});
