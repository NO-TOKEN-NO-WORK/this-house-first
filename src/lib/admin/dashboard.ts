import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  HouseholdStatus,
  HOUSEHOLD_STATUS_LABEL,
  isAlertLevel,
  isOpenHouseholdStatus,
  isRiskGrade,
  parseHouseholdStatus,
  RiskGrade,
  WorkerRole,
} from "../domain";
import { formatBoardDate } from "../board/format";

export type AdminStatusCategory =
  | "emergency"
  | "visit"
  | "unchecked"
  | "unreachable"
  | "called"
  | "resolved";

export interface AdminDashboardWorker {
  id: string;
  name: string;
  phone?: string | null;
  subjectCount?: number;
}

export interface AdminDashboardSubject {
  subjectId: string;
  name: string;
  phone: string | null;
  birthYear: number;
  workerId: string;
  workerName: string;
  workerPhone: string | null;
  buildingId: string;
  address: string;
  lat: number;
  lng: number;
  grade: RiskGrade;
  score: number;
  reasons: string[];
  status: HouseholdStatus;
  statusLabel: string;
  open: boolean;
}

export interface AdminDashboardBuilding {
  buildingId: string;
  address: string;
  lat: number;
  lng: number;
  grade: RiskGrade;
  score: number;
  statusCategory: AdminStatusCategory;
  openCount: number;
  subjects: AdminDashboardSubject[];
}

interface AdminDashboardBase {
  date: string;
  dateLabel: string;
  selectedWorkerId: string | null;
  workers: AdminDashboardWorker[];
  generatedAt: string;
}

interface AdminDashboardSummary {
  total: number;
  open: number;
  openCritical: number;
  visitQueued: number;
  completed: number;
}

export interface AdminSilentDashboard extends AdminDashboardBase {
  alerted: false;
  subjects: [];
  buildings: [];
}

export interface AdminAlertedDashboard extends AdminDashboardBase {
  alerted: true;
  level: AlertLevel;
  levelLabel: string;
  feelsLikeMax: number;
  summary: AdminDashboardSummary;
  subjects: AdminDashboardSubject[];
  buildings: AdminDashboardBuilding[];
}

export type AdminDashboard = AdminSilentDashboard | AdminAlertedDashboard;

export interface AdminAssessmentRow {
  subjectId: string;
  score: number;
  grade: RiskGrade;
  reasons: string;
  subject: {
    id: string;
    name: string;
    phone: string | null;
    birthYear: number;
    workerId: string;
    worker: { name: string; phone: string | null };
    building: {
      id: string;
      address: string;
      roadAddress: string | null;
      lat: number;
      lng: number;
    };
  };
}

export interface AdminStatusRow {
  subjectId: string;
  status: HouseholdStatus;
}

interface AdminSnapshot {
  summary: AdminDashboardSummary;
  subjects: AdminDashboardSubject[];
  buildings: AdminDashboardBuilding[];
}

const STATUS_CATEGORY: Record<HouseholdStatus, AdminStatusCategory> = {
  [HouseholdStatus.EMERGENCY_119]: "emergency",
  [HouseholdStatus.VISITING]: "visit",
  [HouseholdStatus.VISIT_QUEUED]: "visit",
  [HouseholdStatus.NO_ANSWER_1]: "unchecked",
  [HouseholdStatus.UNCHECKED]: "unchecked",
  [HouseholdStatus.UNREACHABLE]: "unreachable",
  [HouseholdStatus.CALL_OK]: "called",
  [HouseholdStatus.RESOLVED]: "resolved",
};

const STATUS_PRIORITY: Record<AdminStatusCategory, number> = {
  emergency: 1,
  visit: 2,
  unchecked: 3,
  unreachable: 4,
  called: 5,
  resolved: 6,
};

export function parseAdminReasons(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      return value;
    }
  } catch {
    // 사실을 숨기지 않는 폴백을 아래에서 반환한다.
  }
  return ["위험 사유를 불러오지 못했습니다"];
}

export function buildAdminSnapshot({
  assessments,
  statuses,
  workerId,
  subjectQuery,
  selectedStatuses,
}: {
  assessments: AdminAssessmentRow[];
  statuses: AdminStatusRow[];
  workerId?: string;
  subjectQuery?: string;
  selectedStatuses?: readonly HouseholdStatus[];
}): AdminSnapshot {
  const statusBySubject = new Map(
    statuses.map((row) => [row.subjectId, row.status]),
  );
  const workerRows = workerId
    ? assessments.filter((row) => row.subject.workerId === workerId)
    : assessments;
  const query = subjectQuery?.trim().toLocaleLowerCase("ko-KR") ?? "";
  const selectedRows = workerRows.filter((row) => {
    const status =
      statusBySubject.get(row.subjectId) ?? HouseholdStatus.UNCHECKED;
    return (
      (!query || row.subject.name.toLocaleLowerCase("ko-KR").includes(query)) &&
      (selectedStatuses === undefined || selectedStatuses.includes(status))
    );
  });
  const subjects = selectedRows
    .map((row) => {
      const status =
        statusBySubject.get(row.subjectId) ?? HouseholdStatus.UNCHECKED;
      return {
        subjectId: row.subjectId,
        name: row.subject.name,
        phone: row.subject.phone,
        birthYear: row.subject.birthYear,
        workerId: row.subject.workerId,
        workerName: row.subject.worker.name,
        workerPhone: row.subject.worker.phone,
        buildingId: row.subject.building.id,
        address: row.subject.building.roadAddress ?? row.subject.building.address,
        lat: row.subject.building.lat,
        lng: row.subject.building.lng,
        grade: row.grade,
        score: row.score,
        reasons: parseAdminReasons(row.reasons),
        status,
        statusLabel: HOUSEHOLD_STATUS_LABEL[status],
        open: isOpenHouseholdStatus(status),
      };
    })
    .sort(
      (left, right) =>
        Number(right.open) - Number(left.open) ||
        left.grade - right.grade ||
        right.score - left.score ||
        left.name.localeCompare(right.name, "ko"),
    );

  const buildings = new Map<string, AdminDashboardBuilding>();
  const summary: AdminDashboardSummary = {
    total: subjects.length,
    open: 0,
    openCritical: 0,
    visitQueued: 0,
    completed: 0,
  };

  for (const subject of subjects) {
    if (subject.open) {
      summary.open += 1;
      if (subject.grade === RiskGrade.CRITICAL) summary.openCritical += 1;
    }
    if (subject.status === HouseholdStatus.VISIT_QUEUED) summary.visitQueued += 1;

    const statusCategory = STATUS_CATEGORY[subject.status];
    const building = buildings.get(subject.buildingId);
    if (!building) {
      buildings.set(subject.buildingId, {
        buildingId: subject.buildingId,
        address: subject.address,
        lat: subject.lat,
        lng: subject.lng,
        grade: subject.grade,
        score: subject.score,
        statusCategory,
        openCount: Number(subject.open),
        subjects: [subject],
      });
      continue;
    }

    building.grade = Math.min(building.grade, subject.grade) as RiskGrade;
    building.score = Math.max(building.score, subject.score);
    if (STATUS_PRIORITY[statusCategory] < STATUS_PRIORITY[building.statusCategory]) {
      building.statusCategory = statusCategory;
    }
    building.openCount += Number(subject.open);
    building.subjects.push(subject);
  }

  summary.completed = summary.total - summary.open;

  return {
    summary,
    subjects,
    buildings: [...buildings.values()].sort((left, right) => right.score - left.score),
  };
}

export async function getAdminDashboard(
  options: {
    date?: string;
    workerId?: string;
    subjectQuery?: string;
    selectedStatuses?: readonly HouseholdStatus[];
    now?: Date;
  } = {},
): Promise<AdminDashboard> {
  const [{ prisma }, { todayInKst }] = await Promise.all([
    import("../db"),
    import("../board/today"),
  ]);
  const now = options.now ?? new Date();
  const date = options.date ?? todayInKst(now);
  const [workers, alertDay] = await Promise.all([
    prisma.worker.findMany({
      where: { role: WorkerRole.WORKER },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: { _count: { select: { subjects: true } } },
    }),
    prisma.alertDay.findUnique({ where: { date } }),
  ]);
  const base: AdminDashboardBase = {
    date,
    dateLabel: formatBoardDate(date),
    selectedWorkerId: options.workerId ?? null,
    workers: workers.map((worker) => ({
      id: worker.id,
      name: worker.name,
      phone: worker.phone,
      subjectCount: worker._count.subjects,
    })),
    generatedAt: now.toISOString(),
  };

  if (!alertDay) {
    return { ...base, alerted: false, subjects: [], buildings: [] };
  }
  if (!isAlertLevel(alertDay.level)) {
    throw new Error(`알 수 없는 경보 단계입니다: ${alertDay.level}`);
  }

  const where = {
    alertDayId: alertDay.id,
    ...(options.workerId ? { subject: { workerId: options.workerId } } : {}),
  };
  const [assessmentRows, statusRows] = await Promise.all([
    prisma.riskAssessment.findMany({
      where,
      include: { subject: { include: { worker: true, building: true } } },
    }),
    prisma.householdDayStatus.findMany({ where }),
  ]);
  const assessments: AdminAssessmentRow[] = assessmentRows.map((row) => {
    if (!isRiskGrade(row.grade)) {
      throw new Error(`알 수 없는 위험 등급입니다: ${row.grade}`);
    }
    return { ...row, grade: row.grade };
  });
  const statuses: AdminStatusRow[] = statusRows.map((row) => ({
    subjectId: row.subjectId,
    status: parseHouseholdStatus(row.status),
  }));
  const snapshot = buildAdminSnapshot({
    assessments,
    statuses,
    subjectQuery: options.subjectQuery,
    selectedStatuses: options.selectedStatuses,
  });

  return {
    ...base,
    alerted: true,
    level: alertDay.level,
    levelLabel: ALERT_LEVEL_LABEL[alertDay.level],
    feelsLikeMax: alertDay.feelsLikeMax,
    ...snapshot,
  };
}
