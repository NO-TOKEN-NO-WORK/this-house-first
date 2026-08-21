import type { BuildingFacts } from "../../src/lib/bldg-hub/mapping";
import type { SlotSpec } from "./config";

/**
 * 건물 선별 — 순수 함수 (네트워크·DB 없음).
 * 후보 목록을 슬롯별 우선순위에 따라 정렬해 돌려준다. 실제 채택(지오코딩 성공 여부)은 seed.ts가 한다.
 */

/** mulberry32 — 의존성 없는 결정적 PRNG. 같은 시드면 같은 건물 조합 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleDeterministic<T>(items: readonly T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** 시드 후보 자격: 주거용 + 사용승인연도 있음 + 지번 주소 있음 */
export function isSeedCandidate(b: BuildingFacts): boolean {
  return b.isResidential && b.builtYear != null && b.address.length > 0;
}

function matches(
  b: BuildingFacts,
  c: { detached: boolean; minYear?: number; maxYear?: number; minFloors?: number },
): boolean {
  if (b.isDetached !== c.detached) return false;
  const y = b.builtYear;
  if (y == null) return false;
  if (c.minYear != null && y < c.minYear) return false;
  if (c.maxYear != null && y >= c.maxYear) return false;
  if (c.minFloors != null && (b.groundFloors == null || b.groundFloors < c.minFloors)) return false;
  return true;
}

/**
 * 슬롯별 후보를 우선순위 조건 순으로 이어붙인다 (중복 제거).
 * seed.ts는 각 슬롯에서 앞에서부터 "아직 안 쓴 + 지오코딩 성공" 건물을 고른다.
 */
export function rankCandidatesForSlots(
  candidates: readonly BuildingFacts[],
  slots: readonly SlotSpec[],
  seed: number,
): BuildingFacts[][] {
  const pool = shuffleDeterministic(
    [...candidates].sort((a, b) => a.mgmBldrgstPk.localeCompare(b.mgmBldrgstPk)),
    seed,
  );
  return slots.map((slot) => {
    const seen = new Set<string>();
    const ranked: BuildingFacts[] = [];
    for (const cond of slot.prefer) {
      for (const b of pool) {
        if (seen.has(b.mgmBldrgstPk) || !matches(b, cond)) continue;
        seen.add(b.mgmBldrgstPk);
        ranked.push(b);
      }
    }
    return ranked;
  });
}

/** 각 버킷(조건)에 후보가 최소 n개씩 있는지 — 페이지를 더 받을지 판단 */
export function hasEnoughCandidates(
  candidates: readonly BuildingFacts[],
  slots: readonly SlotSpec[],
  minPerSlot: number,
): boolean {
  return slots.every((slot) => {
    const first = slot.prefer[0];
    if (!first) return true;
    return candidates.filter((b) => matches(b, first)).length >= minPerSlot;
  });
}
