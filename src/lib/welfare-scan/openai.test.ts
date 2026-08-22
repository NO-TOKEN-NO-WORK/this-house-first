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
      latestMemo: "성명: 홍길동, 010-1234-5678, 서울시 종로구 세종대로 1. 에어컨이 고장났습니다.",
    },
  ];

  it("gpt-5.6-luna high에 메모 최소정보만 보내고 구조화 결과를 읽는다", async () => {
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
                        issues: ["COOLING_ISSUE"],
                        evidence: ["에어컨에서 미지근한 바람만 나옴"],
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
    expect(JSON.stringify(sentBody)).not.toContain("010-1234-5678");
    expect(JSON.stringify(sentBody)).not.toContain("서울시 종로구 세종대로 1");
    expect(result).toEqual([
      {
        subjectId: "database-subject-987",
        issues: ["COOLING_ISSUE"],
        evidence: ["에어컨에서 미지근한 바람만 나옴"],
      },
    ]);
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
