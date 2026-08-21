import { describe, expect, it } from "vitest";
import type { PublicDataFetch } from "./client";
import { getAgePopulation } from "./population";

describe("getAgePopulation", () => {
  it("10세 연령구간을 70세 이상·80세 이상 지표로 정규화한다", async () => {
    const fetcher: PublicDataFetch = async () =>
      new Response(
        JSON.stringify({
          Response: {
            head: { resultCode: "0", resultMsg: "NORMAL_SERVICE" },
            items: {
              item: {
                statsYm: "202607",
                admmCd: "1111054000",
                ctpvNm: "서울특별시",
                sggNm: "종로구",
                dongNm: "삼청동",
                totNmprCnt: "1,000",
                male60AgeNmprCnt: "50",
                feml60AgeNmprCnt: "60",
                male70AgeNmprCnt: "40",
                feml70AgeNmprCnt: "50",
                male80AgeNmprCnt: "20",
                feml80AgeNmprCnt: "30",
                male90AgeNmprCnt: "4",
                feml90AgeNmprCnt: "6",
                male100AgeNmprCnt: "1",
                feml100AgeNmprCnt: "1",
              },
            },
          },
        }),
      );

    const [record] = await getAgePopulation(
      {
        administrationCode: "1111054000",
        fromYearMonth: "202607",
        toYearMonth: "202607",
      },
      { serviceKey: "test", fetcher },
    );

    expect(record.ageBands.age60to69).toBe(110);
    expect(record.age70Plus).toBe(152);
    expect(record.age80Plus).toBe(62);
    expect(record.age70PlusShare).toBe(15.2);
  });
});
