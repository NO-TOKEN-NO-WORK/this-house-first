import { describe, expect, it } from "vitest";
import {
  buildStructureLabel,
  isDetachedPurpose,
  isResidentialPurpose,
  parseUseAprYear,
  toBuildingFacts,
} from "./mapping";

describe("parseUseAprYear", () => {
  it("YYYYMMDD에서 연도를 뽑고, 0·빈 값·비정상 연도는 null", () => {
    expect(parseUseAprYear("19720315")).toBe(1972);
    expect(parseUseAprYear(20101231)).toBe(2010);
    expect(parseUseAprYear("0")).toBeNull();
    expect(parseUseAprYear("")).toBeNull();
    expect(parseUseAprYear(undefined)).toBeNull();
    expect(parseUseAprYear("00000000")).toBeNull();
  });
});

describe("isDetachedPurpose", () => {
  it("건축법 단독주택 계열(단독·다중·다가구·공관)을 모두 단독주택으로 본다", () => {
    expect(isDetachedPurpose("단독주택")).toBe(true);
    expect(isDetachedPurpose("다가구주택")).toBe(true);
    expect(isDetachedPurpose("다중주택")).toBe(true);
    expect(isDetachedPurpose("공동주택")).toBe(false);
    expect(isDetachedPurpose("제2종근린생활시설")).toBe(false);
    expect(isDetachedPurpose(null)).toBe(false);
  });

  it("주용도코드 0100x 대역이면 명칭과 무관하게 단독주택 계열이다", () => {
    expect(isDetachedPurpose("주택", "01003")).toBe(true);
    expect(isDetachedPurpose("아파트", "02001")).toBe(false);
  });
});

describe("isResidentialPurpose", () => {
  it("단독·공동주택 계열만 주거용으로 본다 (시드 선별)", () => {
    expect(isResidentialPurpose("다세대주택")).toBe(true);
    expect(isResidentialPurpose("아파트")).toBe(true);
    expect(isResidentialPurpose("창고시설")).toBe(false);
    expect(isResidentialPurpose(undefined)).toBe(false);
  });
});

describe("buildStructureLabel", () => {
  it("슬레이트·기와 지붕은 사유 라벨에 드러낸다 (PRD F3 예시)", () => {
    expect(buildStructureLabel("벽돌구조", "슬레이트")).toBe("벽돌구조·슬레이트");
    // 건축물대장 한자어 표기 (비산동 실데이터): 와즙=기와, 초즙=초가, 스레트=슬레이트
    expect(buildStructureLabel("목조", "와즙")).toBe("목조·와즙");
    expect(buildStructureLabel("목조", "초즙")).toBe("목조·초즙");
    expect(buildStructureLabel("목조", "스레트")).toBe("목조·스레트");
    expect(buildStructureLabel("블록조", "슬라브")).toBe("블록조");
    expect(buildStructureLabel("철근콘크리트구조", "(철근)콘크리트")).toBe(
      "철근콘크리트구조",
    );
  });

  it("값이 없으면 null", () => {
    expect(buildStructureLabel(null, null)).toBeNull();
    expect(buildStructureLabel("", "  ")).toBeNull();
  });
});

describe("toBuildingFacts", () => {
  it("표제부 항목을 스코어링 입력으로 정규화한다", () => {
    const facts = toBuildingFacts({
      mgmBldrgstPk: "27170-100001",
      platPlc: "대구광역시 서구 비산동 123-4번지 ",
      newPlatPlc: "대구광역시 서구 비산로 1",
      bldNm: "",
      mainPurpsCd: "01001",
      mainPurpsCdNm: "단독주택",
      strctCdNm: "벽돌구조",
      roofCdNm: "슬레이트",
      useAprDay: "19720315",
      grndFlrCnt: "1",
      sigunguCd: 27170,
      bjdongCd: "10100",
    });
    expect(facts).toEqual({
      mgmBldrgstPk: "27170-100001",
      address: "대구광역시 서구 비산동 123-4번지",
      roadAddress: "대구광역시 서구 비산로 1",
      name: null,
      builtYear: 1972,
      isDetached: true,
      isResidential: true,
      structure: "벽돌구조·슬레이트",
      mainPurpose: "단독주택",
      roof: "슬레이트",
      groundFloors: 1,
      bjdongCode: "2717010100",
    });
  });

  it("코드명이 '기타'면 자유 텍스트(etc)의 첫 토큰을 쓴다", () => {
    const facts = toBuildingFacts({
      mgmBldrgstPk: "x",
      platPlc: "a",
      strctCdNm: "기타구조",
      etcStrct: "경량철골조",
      roofCdNm: "기타지붕",
      etcRoof: "기와",
    });
    expect(facts.structure).toBe("경량철골조·기와");
    expect(facts.roof).toBe("기와");
  });

  it("코드명이 있으면 자유 텍스트 나열보다 코드명을 우선한다 (비산동 실데이터 형태)", () => {
    const facts = toBuildingFacts({
      mgmBldrgstPk: "y",
      platPlc: "b",
      strctCdNm: "목구조",
      etcStrct: "목조, 세멘벽돌조, 철근콘크리트",
      roofCdNm: "기타지붕",
      etcRoof: "와즙, 스라브즙, 육즙",
    });
    expect(facts.structure).toBe("목구조·와즙");
    expect(facts.roof).toBe("와즙");
  });

  it("지붕 목록에서 주목할 토큰만 골라 붙인다", () => {
    expect(buildStructureLabel("세멘부로크조", "육즙, 와즙")).toBe("세멘부로크조·와즙");
    expect(buildStructureLabel("세멘부로크조", "육즙, 슬라브")).toBe("세멘부로크조");
  });
});
