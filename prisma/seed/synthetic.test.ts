import { describe, expect, it } from "vitest";
import { BUILDING_SLOTS } from "./config";
import { CHECK_HISTORY, HISTORY_ALERT_DAYS } from "./history";
import { SUBJECTS, WORKERS } from "./synthetic";
import { hasEnoughCandidates, rankCandidatesForSlots, shuffleDeterministic } from "./select";
import type { BuildingFacts } from "../../src/lib/bldg-hub/mapping";

describe("합성 대상자 프로필", () => {
  it("담당자 1인당 15명 (PRD P3)", () => {
    expect(SUBJECTS).toHaveLength(15);
  });

  it("모두 65세 이상이며 이름·전화가 중복되지 않는다 (2026 기준)", () => {
    for (const s of SUBJECTS) expect(2026 - s.birthYear).toBeGreaterThanOrEqual(65);
    expect(new Set(SUBJECTS.map((s) => s.name)).size).toBe(SUBJECTS.length);
    expect(new Set(SUBJECTS.map((s) => s.phone)).size).toBe(SUBJECTS.length);
  });

  it("전화번호는 가상 대역(010-0000-xxxx)만 쓴다 — 실인물 금지", () => {
    for (const s of [...SUBJECTS, ...WORKERS]) expect(s.phone).toMatch(/^010-0000-\d{4}$/);
  });

  it("buildingSlot은 BUILDING_SLOTS 범위 안이고 모든 슬롯에 최소 1명이 산다", () => {
    const used = new Set<number>();
    for (const s of SUBJECTS) {
      expect(s.buildingSlot).toBeGreaterThanOrEqual(0);
      expect(s.buildingSlot).toBeLessThan(BUILDING_SLOTS.length);
      used.add(s.buildingSlot);
    }
    expect(used.size).toBe(BUILDING_SLOTS.length);
  });

  it("모든 대상자에게 유효한 경보일의 확인 기록이 최소 2건씩 있다", () => {
    expect(Object.keys(CHECK_HISTORY).sort()).toEqual(
      SUBJECTS.map((subject) => subject.name).sort(),
    );
    const alertDays = new Set(HISTORY_ALERT_DAYS.map((day) => day.daysAgo));
    for (const checks of Object.values(CHECK_HISTORY)) {
      expect(checks.length).toBeGreaterThanOrEqual(2);
      for (const check of checks) expect(alertDays.has(check.daysAgo)).toBe(true);
    }
  });
});

function facts(partial: Partial<BuildingFacts> & { mgmBldrgstPk: string }): BuildingFacts {
  return {
    address: `대구광역시 서구 비산동 ${partial.mgmBldrgstPk}`,
    roadAddress: null,
    name: null,
    builtYear: 1975,
    isDetached: true,
    isResidential: true,
    structure: null,
    mainPurpose: "단독주택",
    roof: null,
    groundFloors: 1,
    bjdongCode: "2717010100",
    ...partial,
  };
}

describe("건물 선별", () => {
  const pool: BuildingFacts[] = [
    facts({ mgmBldrgstPk: "a", builtYear: 1972 }),
    facts({ mgmBldrgstPk: "b", builtYear: 1979 }),
    facts({ mgmBldrgstPk: "c", builtYear: 1985 }),
    facts({ mgmBldrgstPk: "d", builtYear: 2012 }),
    facts({ mgmBldrgstPk: "e", builtYear: 1990, isDetached: false, mainPurpose: "공동주택", groundFloors: 1 }),
    facts({ mgmBldrgstPk: "f", builtYear: 2003, isDetached: false, mainPurpose: "공동주택", groundFloors: 5 }),
  ];

  it("결정적 셔플 — 같은 시드면 같은 순서", () => {
    expect(shuffleDeterministic([1, 2, 3, 4, 5], 7)).toEqual(shuffleDeterministic([1, 2, 3, 4, 5], 7));
    expect(shuffleDeterministic([1, 2, 3, 4, 5], 7)).not.toEqual([1, 2, 3, 4, 5]);
  });

  it("슬롯 우선 조건에 맞는 후보가 먼저 오고, 없으면 완화 조건으로 이어진다", () => {
    const ranked = rankCandidatesForSlots(pool, BUILDING_SLOTS, 1);
    // 슬롯 0: 1980년 이전 단독 → a,b 가 먼저, 그다음 ANY_DETACHED(c,d)
    expect(ranked[0]!.slice(0, 2).map((b) => b.mgmBldrgstPk).sort()).toEqual(["a", "b"]);
    expect(ranked[0]!.map((b) => b.mgmBldrgstPk)).not.toContain("e");
    // 슬롯 8 (공동주택): e·f 가 앞에
    expect(ranked[8]!.slice(0, 2).map((b) => b.mgmBldrgstPk).sort()).toEqual(["e", "f"]);
    // 슬롯 9 (최상층 가구): 3층 이상 공동주택 f 가 단층 e 보다 먼저
    expect(ranked[9]![0]!.mgmBldrgstPk).toBe("f");
    expect(ranked[9]![1]!.mgmBldrgstPk).toBe("e");
    // 슬롯 7 (2000년 이후 단독): d 가 첫 번째
    expect(ranked[7]![0]!.mgmBldrgstPk).toBe("d");
  });

  it("버킷별 최소 후보 수 판정", () => {
    expect(hasEnoughCandidates(pool, BUILDING_SLOTS, 1)).toBe(true);
    expect(hasEnoughCandidates(pool, BUILDING_SLOTS, 3)).toBe(false);
  });
});
