import { prisma } from "../db";
import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  CheckKind,
  GRADE_LABEL,
  GRADE_PLAN,
  HouseholdStatus,
  HOUSEHOLD_STATUS_LABEL,
  isOpenHouseholdStatus,
  parseHouseholdStatus,
  RiskGrade,
} from "../domain";
import { formatKstDate } from "../public-data/kma";
import { toIsoDate } from "../trigger/alert-date";

/**
 * 담당자 대응 보드 데이터 (FR-4, PRD F3).
 *
 * `/today` 화면과 `/api/subjects`가 같은 함수를 쓴다 — 화면과 API가 다른 답을 내면
 * 데모 중 설명이 꼬인다.
 *
 * 위험 사유(reasons)는 스코어링 엔진이 만든 문자열을 **그대로** 실어 보낸다.
 * UI에서 다시 쓰지 않는 것이 설명 가능성의 조건이다 (AGENTS.md 도메인 규칙 3).
 */

export interface BoardSubject {
  subjectId: string;
  name: string;
  phone: string | null;
  grade: RiskGrade;
  score: number;
  /** 스코어링 엔진이 반환한 위험 사유 — 화면에 그대로 표시 */
  reasons: string[];
  status: HouseholdStatus;
  statusLabel: string;
  callAttempts: number;
  /** 아직 담당자 손이 필요한가 */
  open: boolean;
  /** 이번 기록에서 받아야 할 기록 종류 — 1등급·승격 가구는 방문 */
  nextCheckKind: CheckKind;
  address: string;
  roadAddress: string | null;
  lat: number;
  lng: number;
}

export interface BoardGroup {
  grade: RiskGrade;
  gradeLabel: string;
  /** 등급별 대응 지시 (PRD F3) */
  plan: string;
  subjects: BoardSubject[];
}

interface BoardBase {
  /** "YYYY-MM-DD" (KST) */
  date: string;
}

export interface SilentBoard extends BoardBase {
  alerted: false;
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
    /** 미확인 1등급 — 관리자 대시보드의 핵심 위젯(F5)과 같은 정의 */
    openCritical: number;
    visitQueued: number;
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

export async function getBoard(
  options: { date?: string; workerId?: string; now?: Date } = {},
): Promise<Board> {
  const date = options.date ?? todayInKst(options.now);

  const alertDay = await prisma.alertDay.findUnique({ where: { date } });
  // 비경보일에는 AlertDay 행이 없다 — 침묵이 스펙 (PRD §9)
  if (!alertDay) return { alerted: false, date };

  const assessments = await prisma.riskAssessment.findMany({
    where: {
      alertDayId: alertDay.id,
      ...(options.workerId ? { subject: { workerId: options.workerId } } : {}),
    },
    include: { subject: { include: { building: true } } },
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
  let openCritical = 0;
  let visitQueued = 0;

  for (const row of assessments) {
    const statusRow = statusBySubject.get(row.subjectId);
    const status = statusRow
      ? parseHouseholdStatus(statusRow.status)
      : HouseholdStatus.UNCHECKED;
    const grade = row.grade as RiskGrade;
    const isOpen = isOpenHouseholdStatus(status);

    if (isOpen) open += 1;
    if (isOpen && grade === RiskGrade.CRITICAL) openCritical += 1;
    if (status === HouseholdStatus.VISIT_QUEUED) visitQueued += 1;

    const group = groups.find((g) => g.grade === grade);
    group?.subjects.push({
      subjectId: row.subjectId,
      name: row.subject.name,
      phone: row.subject.phone,
      grade,
      score: row.score,
      reasons: parseReasons(row.reasons),
      status,
      statusLabel: HOUSEHOLD_STATUS_LABEL[status],
      callAttempts: statusRow?.callAttempts ?? 0,
      open: isOpen,
      // 방문 큐에 오른 가구는 전화가 아니라 방문 기록을 받는다 (escalation/transition.ts)
      nextCheckKind:
        status === HouseholdStatus.VISIT_QUEUED ||
        status === HouseholdStatus.VISITING
          ? CheckKind.VISIT
          : CheckKind.CALL,
      address: row.subject.building.address,
      roadAddress: row.subject.building.roadAddress,
      lat: row.subject.building.lat,
      lng: row.subject.building.lng,
    });
  }

  return {
    alerted: true,
    date,
    level: alertDay.level as AlertLevel,
    levelLabel: ALERT_LEVEL_LABEL[alertDay.level as AlertLevel],
    feelsLikeMax: alertDay.feelsLikeMax,
    groups: groups.filter((g) => g.subjects.length > 0),
    summary: { total: assessments.length, open, openCritical, visitQueued },
  };
}
