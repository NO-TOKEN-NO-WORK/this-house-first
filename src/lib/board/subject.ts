import { prisma } from "../db";
import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  type CallResult,
  CALL_RESULT_LABEL,
  CHECK_KIND_LABEL,
  CheckKind,
  GRADE_PLAN,
  GRADE_SEVERITY_LABEL,
  HouseholdStatus,
  HOUSEHOLD_STATUS_LABEL,
  isCallResult,
  isCheckKind,
  isOpenHouseholdStatus,
  isRiskGrade,
  isVisitResult,
  nextCheckKindOf,
  parseHouseholdStatus,
  RiskGrade,
  VisitResult,
  VISIT_GRADE_CHANGE_REASON,
  VISIT_RESULT_LABEL,
} from "../domain";
import { labelReasons, type LabeledReason } from "../scoring/reasons";
import {
  ageOf,
  dongOf,
  formatBoardDate,
  formatHistoryDate,
  yearOfIsoDate,
} from "./format";
import { todayInKst } from "./today";

/**
 * 대상자 상세 (Figma ② 3:505 일반 상세 · 25:347 방문 화면).
 *
 * 보드(`today.ts`)가 "누구부터"를 답한다면 이 화면은 "이 사람에게 지금 무엇을 하고 무엇을
 * 기록할 것인가" 하나만 답한다 (화면당 결정 1개 — PRD §9).
 */

export interface SubjectAssessment {
  grade: RiskGrade;
  /** "심각 초고위험" */
  severityLabel: string;
  /** 위험 단계별 대응 지시 (PRD F3) */
  plan: string;
  score: number;
  /** 스코어링 엔진 문장 그대로 + 개인/건물/기상 분류만 덧붙인 것 */
  reasons: LabeledReason[];
}

export interface SubjectDetail {
  subjectId: string;
  name: string;
  age: number;
  birthYear: number;
  livesAlone: boolean;
  phone: string | null;
  address: string;
  roadAddress: string | null;
  dong: string | null;
  /** "YYYY-MM-DD" (KST) */
  date: string;
  dateLabel: string;
  /** 경보일이 아니면 아래 값은 모두 null — 위험 단계·상태는 경보일에만 존재한다 */
  alerted: boolean;
  levelLabel: string | null;
  feelsLikeMax: number | null;
  assessment: SubjectAssessment | null;
  status: HouseholdStatus | null;
  statusLabel: string | null;
  callAttempts: number;
  /** 아직 담당자 손이 필요한가 */
  open: boolean;
  /** 지금 받을 수 있는 기록 종류. null이면 오늘 이 가구에 남길 기록이 없다 */
  nextCheckKind: CheckKind | null;
  /** 오늘 마지막으로 기록한 결과값 — 기록 버튼에 "선택됨"을 표시한다 (Figma ② 1:848) */
  lastResult: string | null;
  /** 최근 전화·방문 기록 — 방문 전 맥락을 빠르게 읽는 타임라인 (Figma 25:347) */
  recentHistory: SubjectHistoryItem[];
  /** 직전 경보일부터 위험 단계가 올라갔고 원인을 확인할 수 있을 때만 보여 주는 안내 */
  gradeChange: SubjectGradeChange | null;
}

export interface SubjectHistoryItem {
  id: string;
  date: string;
  dateLabel: string;
  kind: CheckKind;
  kindLabel: string;
  result: CallResult | VisitResult;
  resultLabel: string;
  memo: string | null;
}

export interface SubjectGradeChange {
  previousGrade: RiskGrade;
  currentGrade: RiskGrade;
  reason: string;
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
  return ["위험 사유를 불러오지 못했습니다"];
}

/** 대상자를 찾지 못하면 null — 호출부(페이지)가 404로 바꾼다 */
export async function getSubjectDetail(options: {
  subjectId: string;
  date?: string;
  now?: Date;
}): Promise<SubjectDetail | null> {
  const date = options.date ?? todayInKst(options.now);
  const year = yearOfIsoDate(date);

  const subject = await prisma.subject.findUnique({
    where: { id: options.subjectId },
    include: { building: true },
  });
  if (!subject) return null;

  const base = {
    subjectId: subject.id,
    name: subject.name,
    age: ageOf(subject.birthYear, year),
    birthYear: subject.birthYear,
    livesAlone: subject.livesAlone,
    phone: subject.phone,
    address: subject.building.address,
    roadAddress: subject.building.roadAddress,
    dong: dongOf(subject.building.address),
    date,
    dateLabel: formatBoardDate(date),
  };

  const alertDay = await prisma.alertDay.findUnique({ where: { date } });
  if (!alertDay) {
    return {
      ...base,
      alerted: false,
      levelLabel: null,
      feelsLikeMax: null,
      assessment: null,
      status: null,
      statusLabel: null,
      callAttempts: 0,
      open: false,
      nextCheckKind: null,
      lastResult: null,
      recentHistory: [],
      gradeChange: null,
    };
  }

  const key = {
    alertDayId_subjectId: { alertDayId: alertDay.id, subjectId: subject.id },
  };
  const [assessmentRow, statusRow, recentChecks, previousAssessment, airconIssue] =
    await Promise.all([
      prisma.riskAssessment.findUnique({ where: key }),
      prisma.householdDayStatus.findUnique({ where: key }),
      prisma.checkEvent.findMany({
        // 과거 날짜를 열었을 때 미래의 확인 기록을 보여 주지 않는다.
        where: {
          subjectId: subject.id,
          alertDay: { date: { lte: date } },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { alertDay: { select: { date: true } } },
      }),
      prisma.riskAssessment.findFirst({
        where: {
          subjectId: subject.id,
          alertDay: { date: { lt: date } },
        },
        orderBy: { alertDay: { date: "desc" } },
      }),
      prisma.checkEvent.findFirst({
        where: {
          subjectId: subject.id,
          kind: CheckKind.VISIT,
          result: VisitResult.AIRCON_ISSUE,
          alertDay: { date: { lt: date } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const status = statusRow ? parseHouseholdStatus(statusRow.status) : null;
  const open = status !== null && isOpenHouseholdStatus(status);
  const grade =
    assessmentRow && isRiskGrade(assessmentRow.grade)
      ? assessmentRow.grade
      : null;

  const recentHistory: SubjectHistoryItem[] = [];
  for (const row of recentChecks) {
    if (!isCheckKind(row.kind)) continue;
    if (row.kind === CheckKind.CALL) {
      if (!isCallResult(row.result)) continue;
      recentHistory.push({
        id: row.id,
        date: row.alertDay.date,
        dateLabel: formatHistoryDate(row.alertDay.date),
        kind: row.kind,
        kindLabel: CHECK_KIND_LABEL[row.kind],
        result: row.result,
        resultLabel: CALL_RESULT_LABEL[row.result],
        memo: row.memo,
      });
      continue;
    }
    if (!isVisitResult(row.result)) continue;
    recentHistory.push({
      id: row.id,
      date: row.alertDay.date,
      dateLabel: formatHistoryDate(row.alertDay.date),
      kind: row.kind,
      kindLabel: CHECK_KIND_LABEL[row.kind],
      result: row.result,
      resultLabel: VISIT_RESULT_LABEL[row.result],
      memo: row.memo,
    });
  }

  const previousGrade =
    previousAssessment && isRiskGrade(previousAssessment.grade)
      ? previousAssessment.grade
      : null;
  const gradeChangeReason = airconIssue
    ? VISIT_GRADE_CHANGE_REASON[VisitResult.AIRCON_ISSUE]
    : null;
  const gradeChange =
    grade &&
    previousGrade &&
    grade < previousGrade &&
    gradeChangeReason
      ? {
          previousGrade,
          currentGrade: grade,
          reason: gradeChangeReason,
        }
      : null;

  return {
    ...base,
    alerted: true,
    levelLabel: ALERT_LEVEL_LABEL[alertDay.level as AlertLevel],
    feelsLikeMax: alertDay.feelsLikeMax,
    assessment:
      assessmentRow && grade
        ? {
            grade,
            severityLabel: GRADE_SEVERITY_LABEL[grade],
            plan: GRADE_PLAN[grade],
            score: assessmentRow.score,
            reasons: labelReasons(parseReasons(assessmentRow.reasons)),
          }
        : null,
    status,
    statusLabel: status ? HOUSEHOLD_STATUS_LABEL[status] : null,
    callAttempts: statusRow?.callAttempts ?? 0,
    open,
    // 방문 큐에 오른 가구는 전화가 아니라 방문 기록을 받는다 (escalation/transition.ts CALLABLE·VISITABLE)
    nextCheckKind: status ? nextCheckKindOf(status) : null,
    lastResult:
      recentChecks.find((row) => row.alertDayId === alertDay.id)?.result ?? null,
    recentHistory,
    gradeChange,
  };
}
