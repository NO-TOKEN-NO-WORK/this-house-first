import "dotenv/config";
import { fetchBuildingTitles } from "../src/lib/bldg-hub/client";
import { toBuildingFacts, type BuildingFacts } from "../src/lib/bldg-hub/mapping";
import { prisma } from "../src/lib/db";
import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  GRADE_LABEL,
  RiskGrade,
  WorkerRole,
} from "../src/lib/domain";
import { geocodeAddress, resolveRegionCodes } from "../src/lib/kakao/local";
import { simulateWeightedExposure } from "../src/lib/scoring/exposure";
import { assessRisk } from "../src/lib/scoring/score";
import { todayInKst } from "../src/lib/board/today";
import { BUILDING_SLOTS, REGION, SELECTION_SEED } from "./seed/config";
import { CHECK_HISTORY, HISTORY_ALERT_DAYS } from "./seed/history";
import { hasEnoughCandidates, isSeedCandidate, rankCandidatesForSlots } from "./seed/select";
import { SUBJECTS, TOP_FLOOR_SLOTS, WORKERS } from "./seed/synthetic";

/**
 * 시드 — "건물은 진짜, 사람은 가짜" (PRD §8, ADR-0012)
 *
 * 1. 카카오 로컬 API로 지역 질의 → 법정동코드
 * 2. 건축HUB 표제부를 법정동 단위로 받아 주거용·연도 있는 건물을 후보로 모음
 * 3. 슬롯 계획(config.ts)대로 건물 10동 선별 + 카카오 지오코딩으로 좌표 확보
 * 4. 합성 담당자·대상자 15명(synthetic.ts)을 건물에 배정
 * 5. 점수 분포 출력 — 위험 단계 컷오프 캘리브레이션(ADR-0005)용
 *
 * 키가 없거나 API가 실패하면 가짜 건물로 폴백하지 않고 실패한다 (공공데이터 실사용 요건).
 * 실행: npm run db:seed  (기존 시드 데이터는 모두 지우고 다시 만든다 — dev 전용)
 */

const YEAR = 2026;

function requireEnv(names: string[]): void {
  const missing = names.filter((n) => !process.env[n]?.trim());
  if (missing.length) {
    console.error(
      [
        `시드에 필요한 환경변수가 비어 있습니다: ${missing.join(", ")}`,
        "  - PUBLIC_DATA_SERVICE_KEY: 공공데이터포털 '국토교통부_건축HUB_건축물대장정보 서비스' 활용신청 (docs/public-data-apis.md)",
        "  - KAKAO_REST_KEY: Kakao Developers 앱 > REST API 키",
        "가짜 건물로 대체하지 않습니다 — 공공데이터 실사용이 요건입니다 (ADR-0012).",
      ].join("\n"),
    );
    process.exit(1);
  }
}

/**
 * 지번 주소의 "번지" 접미를 떼고 지오코딩. 실패 시 도로명으로 재시도.
 * 정확 매칭(REGION_ADDR 지번 / ROAD_ADDR 도로명)만 받는다 — 동 단위 폴백(REGION)이 섞이면
 * 여러 건물이 동 중심점 한 좌표에 겹친다.
 */
async function geocodeBuilding(b: BuildingFacts): Promise<{ lat: number; lng: number } | null> {
  const queries = [b.address.replace(/번지$/, "").trim(), b.roadAddress ?? ""].filter(Boolean);
  for (const q of queries) {
    const r = await geocodeAddress(q);
    if (r && (r.addressType === "REGION_ADDR" || r.addressType === "ROAD_ADDR")) {
      return { lat: r.lat, lng: r.lng };
    }
  }
  return null;
}

/**
 * 표제부는 지번 순으로 정렬돼 있어 1페이지만 쓰면 건물이 한 블록에 몰린다.
 * 1페이지로 전체 페이지 수를 알아낸 뒤, 나머지는 동 전체에 고르게 분산된 페이지를 받는다
 * (예: 120페이지 중 1·30·60·90·120) — 담당 구역이 동 전체에 퍼진 현실과 FR-7 동선 시연을 위해.
 */
/** 공공데이터포털은 간헐적으로 HTML/빈 응답을 돌려준다 — 짧은 백오프로 재시도 */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts) {
        console.warn(`  ↻ ${label} 실패 (${i}/${attempts}): ${e instanceof Error ? e.message : e} — ${3 * i}초 후 재시도`);
        await sleep(3000 * i);
      }
    }
  }
  throw lastError;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function collectCandidates(sigunguCd: string, bjdongCd: string): Promise<BuildingFacts[]> {
  const seen = new Map<string, BuildingFacts>();
  const ingest = (page: Awaited<ReturnType<typeof fetchBuildingTitles>>, pageNo: number, total: number) => {
    for (const item of page.items) {
      const f = toBuildingFacts(item);
      if (isSeedCandidate(f) && !seen.has(f.mgmBldrgstPk)) seen.set(f.mgmBldrgstPk, f);
    }
    console.log(`  건축HUB p${pageNo}/${total}: ${page.items.length}건 수신, 누적 후보 ${seen.size}건`);
  };

  const first = await withRetry("건축HUB p1", () =>
    fetchBuildingTitles({ sigunguCd, bjdongCd, numOfRows: 100, pageNo: 1 }),
  );
  const totalPages = Math.max(1, Math.ceil(first.totalCount / first.numOfRows));
  ingest(first, 1, totalPages);

  const extra = Math.min(REGION.maxPages, totalPages) - 1;
  const pages = new Set<number>();
  for (let i = 1; i <= extra; i++) pages.add(Math.min(totalPages, Math.round(1 + (i * (totalPages - 1)) / extra)));
  pages.delete(1);
  for (const pageNo of [...pages].sort((a, b) => a - b)) {
    await sleep(500); // 연속 호출 간격 — 포털이 버스트에 간헐적으로 비JSON 응답을 준다
    const page = await withRetry(`건축HUB p${pageNo}`, () =>
      fetchBuildingTitles({ sigunguCd, bjdongCd, numOfRows: 100, pageNo }),
    );
    ingest(page, pageNo, totalPages);
  }
  if (!hasEnoughCandidates([...seen.values()], BUILDING_SLOTS, 3)) {
    console.warn("  ⚠ 일부 슬롯의 후보가 3건 미만입니다 — config.ts maxPages를 늘리면 분포가 좋아집니다");
  }
  return [...seen.values()];
}

async function main(): Promise<void> {
  requireEnv(["PUBLIC_DATA_SERVICE_KEY", "KAKAO_REST_KEY"]);

  // 1. 지역 → 법정동코드
  console.log(`▶ 지역 해석: ${REGION.query}`);
  const region = await resolveRegionCodes(REGION.query);
  if (!region) throw new Error(`카카오 로컬에서 법정동코드를 찾지 못했습니다: ${REGION.query}`);
  console.log(`  ${region.addressName} → sigunguCd=${region.sigunguCd} bjdongCd=${region.bjdongCd}`);

  // 2. 건축HUB 후보 수집
  console.log("▶ 건축물대장 표제부 수집 (국토교통부 건축HUB)");
  const candidates = await collectCandidates(region.sigunguCd, region.bjdongCd);
  if (candidates.length === 0) throw new Error("주거용 건물 후보가 없습니다. 지역 코드를 확인하세요.");

  // 3. 슬롯별 선별 + 지오코딩
  console.log("▶ 건물 선별 + 지오코딩 (카카오 로컬)");
  const ranked = rankCandidatesForSlots(candidates, BUILDING_SLOTS, SELECTION_SEED);
  const used = new Set<string>();
  const chosen: Array<BuildingFacts & { lat: number; lng: number; slot: number }> = [];
  for (const [slot, spec] of BUILDING_SLOTS.entries()) {
    let picked: (BuildingFacts & { lat: number; lng: number }) | null = null;
    for (const b of ranked[slot] ?? []) {
      if (used.has(b.mgmBldrgstPk)) continue;
      const coord = await geocodeBuilding(b);
      if (!coord) continue;
      picked = { ...b, ...coord };
      break;
    }
    if (!picked) throw new Error(`슬롯 "${spec.label}"에 맞는 건물을 찾지 못했습니다 (후보 ${ranked[slot]?.length ?? 0}건)`);
    used.add(picked.mgmBldrgstPk);
    chosen.push({ ...picked, slot });
    console.log(`  [${slot}] ${spec.label}: ${picked.address} · ${picked.mainPurpose} · ${picked.builtYear}년 · ${picked.structure ?? "-"}`);
  }

  // 4. DB 기록 (dev 전용 — 전부 지우고 다시 만든다)
  console.log("▶ DB 초기화 및 기록");
  await prisma.$transaction([
    prisma.pushSubscription.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.checkEvent.deleteMany(),
    prisma.householdDayStatus.deleteMany(),
    prisma.riskAssessment.deleteMany(),
    prisma.alertDay.deleteMany(),
    prisma.subject.deleteMany(),
    prisma.building.deleteMany(),
    prisma.worker.deleteMany(),
  ]);

  const workers = await Promise.all(WORKERS.map((w) => prisma.worker.create({ data: w })));
  const careWorker = workers.find((w) => w.role === WorkerRole.WORKER) ?? workers[0]!;

  const buildingIds = new Map<number, string>();
  for (const b of chosen) {
    const row = await prisma.building.create({
      data: {
        address: b.address,
        roadAddress: b.roadAddress,
        lat: b.lat,
        lng: b.lng,
        builtYear: b.builtYear,
        isDetached: b.isDetached,
        structure: b.structure,
        hasTopFloorUnit: TOP_FLOOR_SLOTS.has(b.slot),
        mgmBldrgstPk: b.mgmBldrgstPk,
        mainPurpose: b.mainPurpose,
        roof: b.roof,
        groundFloors: b.groundFloors,
        bjdongCode: b.bjdongCode ?? region.sigunguCd + region.bjdongCd,
      },
    });
    buildingIds.set(b.slot, row.id);
  }

  const seededSubjects = [];
  for (const s of SUBJECTS) {
    const { buildingSlot, ...data } = s;
    const subject = await prisma.subject.create({
      data: { ...data, buildingId: buildingIds.get(buildingSlot)!, workerId: careWorker.id },
    });
    seededSubjects.push(subject);
  }

  // 4-b. 과거 경보일 + 합성 확인 기록 — 맥락 브리핑(FR-12)의 유일한 입력 (ADR-0024)
  const checkCount = await seedCheckHistory(seededSubjects, careWorker.id);

  // 5. 점수 분포 — 컷오프 캘리브레이션용 (순수 함수라 DB 재조회 없이 계산)
  console.log("\n▶ 위험점수 분포 (컷오프 캘리브레이션용, weights.ts GRADE_CUTOFF 참고)");
  for (const level of [AlertLevel.EMERGENCY, AlertLevel.WARNING, AlertLevel.ADVISORY]) {
    const counts: Record<RiskGrade, number> = { 1: 0, 2: 0, 3: 0 };
    const rows = SUBJECTS.map((s) => {
      const b = chosen[s.buildingSlot]!;
      const r = assessRisk({
        subject: s,
        building: { ...b, hasTopFloorUnit: TOP_FLOOR_SLOTS.has(b.slot) },
        level,
        year: YEAR,
      });
      counts[r.grade]++;
      return { name: s.name, score: r.score, grade: r.grade, reasons: r.reasons.join(" / ") };
    }).sort((a, b) => b.score - a.score);
    console.log(`\n  [${ALERT_LEVEL_LABEL[level]}] ${GRADE_LABEL[RiskGrade.CRITICAL]} ${counts[1]}명 · ${GRADE_LABEL[RiskGrade.HIGH]} ${counts[2]}명 · ${GRADE_LABEL[RiskGrade.MODERATE]} ${counts[3]}명`);
    if (level === AlertLevel.EMERGENCY) {
      for (const r of rows) console.log(`    ${String(r.score).padStart(5)}  ${GRADE_LABEL[r.grade]}  ${r.name}  ${r.reasons}`);
      const exposure = simulateWeightedExposure(rows.map((r) => r.score));
      console.log(
        `    위험가중 미확인 노출: 무작위 기대 ${exposure.randomExpected.toFixed(1)} → 위험순 ${exposure.prioritized.toFixed(1)} (${(exposure.reductionRate * 100).toFixed(1)}% 감소)`,
      );
    }
  }

  console.log(
    `\n✔ 시드 완료: 담당자 ${workers.length}명 · 건물 ${chosen.length}동(실 건축물대장) · 대상자 ${SUBJECTS.length}명(합성) · 확인 기록 ${checkCount}건(합성 이력)`,
  );
}

/**
 * 과거 경보일과 그날의 확인 기록을 만든다 (`seed/history.ts`).
 *
 * 오늘 날짜에는 아무것도 만들지 않는다 — 오늘의 발령은 트리거(FR-1)나 관리자 데모 토글의 몫이고,
 * 시드가 오늘을 경보일로 만들면 "평상시엔 조용하다"는 데모 첫 장면이 깨진다 (PRD §10).
 *
 * `RiskAssessment`·`HouseholdDayStatus`도 만들지 않는다. 브리핑에 필요한 것은 기록 원장뿐이고,
 * 과거 평가를 넣으면 상세 화면의 "오늘 위험 단계가 올라갔어요" 안내가 시드 때문에 뜬다.
 */
async function seedCheckHistory(
  subjects: Array<{ id: string; name: string }>,
  workerId: string,
): Promise<number> {
  console.log("▶ 합성 확인 기록 이력 (맥락 브리핑 입력, FR-12)");
  const today = todayInKst();
  const subjectIds = new Map(subjects.map((s) => [s.name, s.id] as const));
  const alertDayIds = new Map<number, string>();

  for (const day of HISTORY_ALERT_DAYS) {
    const row = await prisma.alertDay.create({
      data: {
        date: shiftIsoDate(today, -day.daysAgo),
        level: day.level,
        feelsLikeMax: day.feelsLikeMax,
      },
    });
    alertDayIds.set(day.daysAgo, row.id);
  }

  let created = 0;
  for (const [name, checks] of Object.entries(CHECK_HISTORY)) {
    const subjectId = subjectIds.get(name);
    if (!subjectId) throw new Error(`확인 기록의 대상자를 찾지 못했습니다: ${name}`);
    for (const check of checks) {
      const alertDayId = alertDayIds.get(check.daysAgo);
      if (!alertDayId) {
        throw new Error(`확인 기록의 경보일이 없습니다: ${check.daysAgo}일 전`);
      }
      await prisma.checkEvent.create({
        data: {
          alertDayId,
          subjectId,
          workerId,
          kind: check.kind,
          result: check.result,
          memo: check.memo,
          // 같은 날 여러 건은 시각을 벌려 둔다 — 최신 기록 판정(캐시 키)이 흔들리지 않게 한다
          createdAt: checkEventTime(today, check.daysAgo, check.order ?? 0),
        },
      });
      created += 1;
    }
  }

  console.log(`  경보일 ${HISTORY_ALERT_DAYS.length}일 · 확인 기록 ${created}건`);
  return created;
}

/** "YYYY-MM-DD"에 일 단위로 더한다 (KST 날짜 문자열 그대로 다룬다) */
function shiftIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** 그날 오전 9시(KST) 기준으로 순서만큼 30분씩 민다 — KST 09:00은 UTC 00:00이다 */
function checkEventTime(today: string, daysAgo: number, order: number): Date {
  const base = Date.parse(`${shiftIsoDate(today, -daysAgo)}T00:00:00.000Z`);
  return new Date(base + order * 30 * 60_000);
}

main()
  .catch((e) => {
    console.error("✖ 시드 실패:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
