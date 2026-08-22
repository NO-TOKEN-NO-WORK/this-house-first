import { prisma } from "../db";
import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  type CheckKind,
  GRADE_LABEL,
  GRADE_PLAN,
  HouseholdStatus,
  HOUSEHOLD_STATUS_LABEL,
  isOpenHouseholdStatus,
  nextCheckKindOf,
  parseHouseholdStatus,
  RiskGrade,
  WorkerRole,
} from "../domain";
import { formatKstDate } from "../public-data/kma";
import { toIsoDate } from "../trigger/alert-date";
import { ageOf, dongOf, formatBoardDate, yearOfIsoDate } from "./format";

/**
 * 담당자 대응 보드 데이터 (FR-4, PRD F3).
 *
 * `/today` 화면과 `/api/subjects`가 같은 함수를 쓴다 — 화면과 API가 다른 답을 내면
 * 데모 중 설명이 꼬인다.
 *
 * 위험 사유(reasons)는 스코어링 엔진이 만든 문자열을 **그대로** 실어 보낸다.
 * UI에서 다시 쓰지 않는 것이 설명 가능성의 조건이다 (AGENTS.md 도메인 규칙 3).
 */

/** 경보일·비경보일 카드가 공통으로 쓰는 대상자 정보 (Figma ① 8:1867 profile) */
export interface RosterSubject {
  subjectId: string;
  buildingId: string;
  name: string;
  /** 경보일 기준 연도로 계산한 나이 — 스코어링 엔진의 "(88세)"와 같은 값 */
  age: number;
  livesAlone: boolean;
  phone: string | null;
  address: string;
  roadAddress: string | null;
  lat: number;
  lng: number;
}

export interface BoardSubject extends RosterSubject {
  /** 상세 화면이 보드 데이터만으로 그려질 때 나이와 함께 보존한다 */
  birthYear: number;
  grade: RiskGrade;
  score: number;
  /** 스코어링 엔진이 반환한 위험 사유 — 화면에 그대로 표시 */
  reasons: string[];
  status: HouseholdStatus;
  statusLabel: string;
  callAttempts: number;
  /** 아직 담당자 손이 필요한가 */
  open: boolean;
  /** 이번 기록에서 받아야 할 기록 종류 — 심각·승격 가구는 방문, 끝난 가구는 null */
  nextCheckKind: CheckKind | null;
  /** 오늘 마지막 확인 결과 — 상세 기록 버튼의 "선택됨"에 쓴다 */
  lastResult: string | null;
}

export interface BoardGroup {
  grade: RiskGrade;
  gradeLabel: string;
  /** 위험 단계별 대응 지시 (PRD F3) */
  plan: string;
  subjects: BoardSubject[];
}

/** 화면 상단 인사에 쓰는 담당자 (Figma ① 8:1981 "어서오세요 000님") */
export interface BoardWorker {
  id: string;
  name: string;
}

interface BoardBase {
  /** "YYYY-MM-DD" (KST) */
  date: string;
  /** "8월 21일(금)" */
  dateLabel: string;
  /** 담당자가 한 명도 없으면 null */
  worker: BoardWorker | null;
  /** 담당 구역 동 이름. 주소에서 못 뽑으면 null */
  dong: string | null;
}

export interface SilentBoard extends BoardBase {
  alerted: false;
  /**
   * 비경보일 명단 (Figma ①-b 14:2926).
   * 경보가 없으면 위험 단계·상태가 없다 — 순서를 정해 주지 않고 담당 가구만 보여준다.
   * 알림은 여전히 0건이다 (PRD §9 침묵 원칙은 알림에 대한 것이고, 명단 조회는 담당자가 연 화면이다).
   */
  subjects: RosterSubject[];
}

export interface AlertedBoard extends BoardBase {
  alerted: true;
  level: AlertLevel;
  levelLabel: string;
  feelsLikeMax: number;
  groups: BoardGroup[];
  summary: {
    total: number;
    /** 아직 처리되지 않은 가구 수 — 이 수가 0이 되는 게 그날의 목표 */
    open: number;
    /** 미확인 심각 — 관리자 대시보드의 핵심 위젯(F5)과 같은 정의 */
    openCritical: number;
    visitQueued: number;
    /** 위험 단계별 미처리 가구 수 — 요약 카드의 위험 단계 칸 (Figma ① 8:1833) */
    openByGrade: Record<RiskGrade, number>;
  };
}

export type Board = SilentBoard | AlertedBoard;

/** 오늘 날짜 (KST) "YYYY-MM-DD" */
export function todayInKst(now: Date = new Date()): string {
  return toIsoDate(formatKstDate(now));
}

function parseReasons(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((r) => typeof r === "string")) {
      return parsed;
    }
  } catch {
    // 아래 폴백
  }
  // 조용히 비우면 화면이 "사유 없음"처럼 보인다 — 사실대로 알린다
  return ["위험 사유를 불러오지 못했습니다"];
}

const GRADE_ORDER: readonly RiskGrade[] = [
  RiskGrade.CRITICAL,
  RiskGrade.HIGH,
  RiskGrade.MODERATE,
];

/**
 * 보드를 볼 담당자를 정한다.
 *
 * `/today`는 담당자 한 사람의 화면이라 인사말과 명단이 같은 사람을 가리켜야 한다.
 * v0에는 로그인이 없으므로(ADR-0008 범위 밖) workerId가 없으면 생활지원사 계정을 기본으로 쓴다.
 */
async function resolveWorker(workerId?: string): Promise<BoardWorker | null> {
  const worker = workerId
    ? await prisma.worker.findUnique({ where: { id: workerId } })
    : await prisma.worker.findFirst({
        where: { role: WorkerRole.WORKER },
        orderBy: { id: "asc" },
      });
  return worker ? { id: worker.id, name: worker.name } : null;
}

export async function getBoard(
  options: { date?: string; workerId?: string; now?: Date } = {},
): Promise<Board> {
  const date = options.date ?? todayInKst(options.now);
  const dateLabel = formatBoardDate(date);
  const year = yearOfIsoDate(date);
  const worker = await resolveWorker(options.workerId);
  // 요청한 담당자를 못 찾았으면 남의 명단을 대신 보여주지 않는다 — 빈 명단이 맞다
  const workerId = options.workerId ?? worker?.id ?? null;

  const alertDay = await prisma.alertDay.findUnique({ where: { date } });

  // 비경보일에는 AlertDay 행이 없다 — 위험 단계도 상태도 없이 담당 가구만 보여준다 (Figma ①-b)
  if (!alertDay) {
    const rows = await prisma.subject.findMany({
      where: workerId ? { workerId } : { id: { in: [] } },
      include: { building: true },
      // 경보일 정렬(위험 점수)이 없으므로 나이 많은 순으로 둔다
      orderBy: [{ birthYear: "asc" }, { name: "asc" }],
    });
    const subjects: RosterSubject[] = rows.map((row) => ({
      subjectId: row.id,
      buildingId: row.building.id,
      name: row.name,
      age: ageOf(row.birthYear, year),
      livesAlone: row.livesAlone,
      phone: row.phone,
      address: row.building.address,
      roadAddress: row.building.roadAddress,
      lat: row.building.lat,
      lng: row.building.lng,
    }));
    return {
      alerted: false,
      date,
      dateLabel,
      worker,
      dong: subjects[0] ? dongOf(subjects[0].address) : null,
      subjects,
    };
  }

  const assessments = await prisma.riskAssessment.findMany({
    where: {
      alertDayId: alertDay.id,
      ...(workerId ? { subject: { workerId } } : { subjectId: { in: [] } }),
    },
    include: {
      subject: {
        include: {
          building: true,
          // 상세를 보드 데이터로 열 때 "선택됨" 표시에 필요 — 왕복을 늘리지 않고 끼워 넣는다
          checkEvents: {
            where: { alertDayId: alertDay.id },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { result: true },
          },
        },
      },
    },
    orderBy: { score: "desc" },
  });

  const statusRows = await prisma.householdDayStatus.findMany({
    where: { alertDayId: alertDay.id },
  });
  const statusBySubject = new Map(statusRows.map((r) => [r.subjectId, r]));

  const groups: BoardGroup[] = GRADE_ORDER.map((grade) => ({
    grade,
    gradeLabel: GRADE_LABEL[grade],
    plan: GRADE_PLAN[grade],
    subjects: [],
  }));

  let open = 0;
  let visitQueued = 0;
  const openByGrade: Record<RiskGrade, number> = {
    [RiskGrade.CRITICAL]: 0,
    [RiskGrade.HIGH]: 0,
    [RiskGrade.MODERATE]: 0,
  };

  for (const row of assessments) {
    const statusRow = statusBySubject.get(row.subjectId);
    const status = statusRow
      ? parseHouseholdStatus(statusRow.status)
      : HouseholdStatus.UNCHECKED;
    const grade = row.grade as RiskGrade;
    const isOpen = isOpenHouseholdStatus(status);

    if (isOpen) {
      open += 1;
      openByGrade[grade] += 1;
    }
    if (status === HouseholdStatus.VISIT_QUEUED) visitQueued += 1;

    const group = groups.find((g) => g.grade === grade);
    group?.subjects.push({
      subjectId: row.subjectId,
      buildingId: row.subject.building.id,
      name: row.subject.name,
      age: ageOf(row.subject.birthYear, year),
      birthYear: row.subject.birthYear,
      livesAlone: row.subject.livesAlone,
      phone: row.subject.phone,
      address: row.subject.building.address,
      roadAddress: row.subject.building.roadAddress,
      lat: row.subject.building.lat,
      lng: row.subject.building.lng,
      grade,
      score: row.score,
      reasons: parseReasons(row.reasons),
      status,
      statusLabel: HOUSEHOLD_STATUS_LABEL[status],
      callAttempts: statusRow?.callAttempts ?? 0,
      open: isOpen,
      nextCheckKind: nextCheckKindOf(status),
      lastResult: row.subject.checkEvents[0]?.result ?? null,
    });
  }

  const firstAddress = groups.flatMap((g) => g.subjects)[0]?.address;

  return {
    alerted: true,
    date,
    dateLabel,
    worker,
    dong: firstAddress ? dongOf(firstAddress) : null,
    level: alertDay.level as AlertLevel,
    levelLabel: ALERT_LEVEL_LABEL[alertDay.level as AlertLevel],
    feelsLikeMax: alertDay.feelsLikeMax,
    groups: groups.filter((g) => g.subjects.length > 0),
    summary: {
      total: assessments.length,
      open,
      openCritical: openByGrade[RiskGrade.CRITICAL],
      visitQueued,
      openByGrade,
    },
  };
}
