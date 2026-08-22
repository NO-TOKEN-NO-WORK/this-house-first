import { describe, expect, it } from "vitest";
import type { PublicDataFetch } from "./client";
import { refreshWelfarePrograms } from "./welfare";

describe("중앙부처 복지서비스 동기화", () => {
  it("복지로 XML 목록에서 관련 사업만 골라 상세 자격 조건을 합친다", async () => {
    const requested: URL[] = [];
    const fetcher: PublicDataFetch = async (url) => {
      requested.push(url);
      if (url.pathname.endsWith("NationalWelfarelistV001")) {
        return new Response(`
          <wantedList>
            <resultCode>0</resultCode>
            <resultMessage>정상</resultMessage>
            <servList>
              <servId>WLF-ENERGY</servId>
              <servNm><![CDATA[저소득층 에너지효율개선사업]]></servNm>
              <jurMnofNm>기후에너지환경부</jurMnofNm>
              <servDgst>냉방기기 &amp; 단열 개선 지원</servDgst>
              <servDtlLink>https://www.bokjiro.go.kr/energy</servDtlLink>
              <lifeArray>노년</lifeArray>
              <trgterIndvdlArray>저소득</trgterIndvdlArray>
            </servList>
            <servList>
              <servId>WLF-EDU</servId>
              <servNm>평생교육 지원</servNm>
              <jurMnofNm>교육부</jurMnofNm>
              <servDgst>성인 학습비 지원</servDgst>
              <servDtlLink>https://www.bokjiro.go.kr/education</servDtlLink>
              <lifeArray>성인</lifeArray>
              <trgterIndvdlArray>전체</trgterIndvdlArray>
            </servList>
          </wantedList>
        `);
      }
      return new Response(`
        <wantedDtl>
          <resultCode>0</resultCode>
          <servId>WLF-ENERGY</servId>
          <servNm>저소득층 에너지효율개선사업</servNm>
          <jurMnofNm>기후에너지환경부</jurMnofNm>
          <wlfareInfoOutlCn>냉방기기와 단열 개선을 지원합니다.</wlfareInfoOutlCn>
          <slctCritCn>기초생활수급자 또는 차상위계층</slctCritCn>
          <tgtrDtlCn>저소득 노인가구</tgtrDtlCn>
        </wantedDtl>
      `);
    };

    const programs = await refreshWelfarePrograms({
      serviceKey: "test key",
      fetcher,
    });

    expect(programs).toEqual([
      {
        id: "WLF-ENERGY",
        name: "저소득층 에너지효율개선사업",
        ministry: "기후에너지환경부",
        summary: "냉방기기와 단열 개선을 지원합니다.",
        selectionCriteria: "기초생활수급자 또는 차상위계층",
        target: "저소득 노인가구",
        link: "https://www.bokjiro.go.kr/energy",
      },
    ]);
    expect(requested).toHaveLength(2);
    expect(requested[0].searchParams.get("callTp")).toBe("L");
    expect(requested[0].searchParams.get("numOfRows")).toBe("500");
    expect(requested[1].searchParams.get("servId")).toBe("WLF-ENERGY");
  });
});
