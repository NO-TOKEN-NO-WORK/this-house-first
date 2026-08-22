import { describe, expect, it } from "vitest";
import {
  RecommendationStatus,
  recommendWelfarePrograms,
} from "./eligibility";

describe("복지 자격 엔진", () => {
  const profile = {
    subjectId: "subject-1",
    name: "김○○",
    age: 88,
    livesAlone: true,
    hasAircon: false,
    airconBroken: true,
    workerName: "이미경",
    latestMemo: "에어컨에서 미지근한 바람만 나옵니다.",
  };

  it("소득 조건을 확인하지 못한 사업은 자격을 확정하지 않는다", () => {
    const [recommendation] = recommendWelfarePrograms({
      profile,
      signal: {
        subjectId: profile.subjectId,
        issues: ["COOLING_ISSUE", "ENERGY_COST"],
        evidence: ["에어컨에서 미지근한 바람만 나옴"],
      },
      programs: [
        {
          id: "energy-1",
          name: "저소득층 에너지효율개선사업",
          ministry: "기후에너지환경부",
          summary: "냉방기기와 단열 개선을 지원합니다.",
          selectionCriteria: "기초생활수급자 또는 차상위계층",
          target: "저소득 노인가구",
          link: "https://www.bokjiro.go.kr/",
        },
      ],
    });

    expect(recommendation).toMatchObject({
      programId: "energy-1",
      status: RecommendationStatus.NEEDS_INFO,
      missingChecks: ["기초생활수급 또는 차상위 여부"],
    });
  });

  it("확인된 냉방 문제와 노년 조건만 있는 사업은 가능성 높음으로 분류한다", () => {
    const [recommendation] = recommendWelfarePrograms({
      profile,
      signal: {
        subjectId: profile.subjectId,
        issues: ["COOLING_ISSUE"],
        evidence: ["에어컨 고장"],
      },
      programs: [
        {
          id: "cooling-1",
          name: "폭염 취약노인 냉방용품 지원",
          ministry: "보건복지부",
          summary: "65세 이상 폭염 취약노인에게 냉방용품을 지원합니다.",
          selectionCriteria: "65세 이상이며 냉방기기가 없거나 고장 난 사람",
          target: "노년",
          link: "https://www.bokjiro.go.kr/",
        },
      ],
    });

    expect(recommendation).toMatchObject({
      programId: "cooling-1",
      status: RecommendationStatus.HIGH,
      missingChecks: [],
    });
  });

  it("감지 문제와 무관한 사업은 추천하지 않는다", () => {
    const recommendations = recommendWelfarePrograms({
      profile,
      signal: {
        subjectId: profile.subjectId,
        issues: ["COOLING_ISSUE"],
        evidence: ["에어컨 고장"],
      },
      programs: [
        {
          id: "education-1",
          name: "평생교육 바우처",
          ministry: "교육부",
          summary: "성인의 평생교육 수강료를 지원합니다.",
          selectionCriteria: "성인 학습자",
          target: "성인",
          link: "https://www.bokjiro.go.kr/",
        },
      ],
    });

    expect(recommendations).toEqual([]);
  });
});
