import "dotenv/config";
import { fetchBuildingTitles } from "../src/lib/bldg-hub/client";
import { toBuildingFacts, type BuildingFacts } from "../src/lib/bldg-hub/mapping";
import { prisma } from "../src/lib/db";
import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  CallResult,
  CheckKind,
  GRADE_LABEL,
  RiskGrade,
  VisitResult,
  WorkerRole,
} from "../src/lib/domain";
import { geocodeAddress, resolveRegionCodes } from "../src/lib/kakao/local";
import { simulateWeightedExposure } from "../src/lib/scoring/exposure";
import { assessRisk } from "../src/lib/scoring/score";
import { BUILDING_SLOTS, REGION, SELECTION_SEED } from "./seed/config";
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

  /*
   * FR-12 데모 입력 — 사람·메모는 전부 합성이다.
   * 건물대장 실주소와 분리해 생활 맥락만 만들며, 이름·전화·주소·기관 고유명은 메모에 넣지 않는다.
   */
  const historyDays = await Promise.all([
    prisma.alertDay.create({
      data: { date: "2026-08-17", level: AlertLevel.ADVISORY, feelsLikeMax: 33 },
    }),
    prisma.alertDay.create({
      data: { date: "2026-08-19", level: AlertLevel.WARNING, feelsLikeMax: 35 },
    }),
    prisma.alertDay.create({
      data: { date: "2026-08-20", level: AlertLevel.EMERGENCY, feelsLikeMax: 38 },
    }),
  ]);
  const contextMemos = [
    "평소 아침 일찍 산책하고 오후에는 집에서 쉬는 편이라고 했다.",
    "경로당에서 이웃들과 꽃과 텃밭 이야기를 나누는 시간이 중요하다고 했다.",
    "가까운 거리는 걸어서 다니지만 먼 병원은 버스로 이동한다고 했다.",
    "최근 무릎이 불편해 외출이 줄었고 다음 진료 때 이동 방법이 걱정된다고 했다.",
    "복지 프로그램에 관심은 있지만 전화 신청 절차가 복잡하게 느껴진다고 했다.",
  ] as const;
  const ongoingMemos = [
    "지난 통화에서 말한 냉방기 리모컨 문제가 해결됐는지 다음 방문에 확인하기로 했다.",
    "요즘 식사 시간이 불규칙해져 점심을 챙겨 드시는지 다시 묻기로 했다.",
    "가족과 주말에 통화하기로 했는데 연락이 이어졌는지 확인이 필요하다.",
    "최근 외출이 줄어 이웃과 만나는 시간도 줄었는지 살펴보기로 했다.",
    "다음 주 진료에 갈 교통편을 아직 정하지 못해 함께 확인하기로 했다.",
  ] as const;

  await prisma.checkEvent.createMany({
    data: seededSubjects.flatMap((subject, index) => [
      {
        alertDayId: historyDays[0]!.id,
        subjectId: subject.id,
        workerId: careWorker.id,
        kind: CheckKind.CALL,
        result: CallResult.OK,
        memo: contextMemos[index % contextMemos.length],
        createdAt: new Date("2026-08-17T01:00:00.000Z"),
      },
      {
        alertDayId: historyDays[1]!.id,
        subjectId: subject.id,
        workerId: careWorker.id,
        kind: CheckKind.CALL,
        result: CallResult.OK,
        memo: ongoingMemos[index % ongoingMemos.length],
        createdAt: new Date("2026-08-19T01:00:00.000Z"),
      },
      {
        alertDayId: historyDays[2]!.id,
        subjectId: subject.id,
        workerId: careWorker.id,
        kind: CheckKind.VISIT,
        result: index % 4 === 0 ? VisitResult.AIRCON_ISSUE : VisitResult.OK,
        memo: index % 4 === 0
          ? "냉방기가 제대로 작동하지 않아 점검이 필요했고 다음 방문에 상태를 다시 보기로 했다."
          : "집 안 온도와 냉방기 작동을 확인했고 물을 자주 마시고 있었다.",
        createdAt: new Date("2026-08-20T01:00:00.000Z"),
      },
    ]),
  });

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

  console.log(`\n✔ 시드 완료: 담당자 ${workers.length}명 · 건물 ${chosen.length}동(실 건축물대장) · 대상자 ${SUBJECTS.length}명(합성) · 합성 확인 기록 ${seededSubjects.length * 3}건`);
}

main()
  .catch((e) => {
    console.error("✖ 시드 실패:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
