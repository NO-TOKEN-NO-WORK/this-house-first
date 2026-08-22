import { prisma } from "../db";
import { ageOf } from "../board/format";
import { todayInKst } from "../board/today";
import {
  CALL_RESULT_LABEL,
  CheckKind,
  CHECK_KIND_LABEL,
  GRADE_LABEL,
  HOUSEHOLD_STATUS_LABEL,
  isCallResult,
  isRiskGrade,
  isVisitResult,
  parseHouseholdStatus,
  VISIT_RESULT_LABEL,
  WorkerRole,
} from "../domain";
import { parseAdminReasons } from "./dashboard";

const DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Seoul",
});

function checkResultLabel(kind: string, result: string): string {
  if (kind === CheckKind.CALL && isCallResult(result)) return CALL_RESULT_LABEL[result];
  if (kind === CheckKind.VISIT && isVisitResult(result)) return VISIT_RESULT_LABEL[result];
  return "결과 확인 필요";
}

export async function getAdminSubjectOptions() {
  const [workers, buildings] = await Promise.all([
    prisma.worker.findMany({
      where: { role: WorkerRole.WORKER },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.building.findMany({
      orderBy: [{ roadAddress: "asc" }, { address: "asc" }],
    }),
  ]);
  return { workers, buildings };
}

export async function getAdminSubjectDetail(subjectId: string, date = todayInKst()) {
  const [subject, { workers, buildings }] = await Promise.all([
    prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        worker: true,
        building: true,
        assessments: {
          where: { alertDay: { date } },
          include: { alertDay: true },
          take: 1,
        },
        dayStatuses: {
          where: { alertDay: { date } },
          take: 1,
        },
        checkEvents: {
          include: { worker: true, alertDay: true },
          orderBy: { createdAt: "desc" },
          take: 8,
        },
      },
    }),
    getAdminSubjectOptions(),
  ]);
  if (!subject) return null;

  const assessment = subject.assessments[0];
  const grade = assessment && isRiskGrade(assessment.grade) ? assessment.grade : null;
  const status = subject.dayStatuses[0]
    ? parseHouseholdStatus(subject.dayStatuses[0].status)
    : null;
  const reasons = assessment ? parseAdminReasons(assessment.reasons) : [];
  const address = subject.building.roadAddress ?? subject.building.address;

  return {
    id: subject.id,
    name: subject.name,
    birthYear: subject.birthYear,
    age: ageOf(subject.birthYear, Number(date.slice(0, 4))),
    phone: subject.phone,
    livesAlone: subject.livesAlone,
    hasMobilityIssue: subject.hasMobilityIssue,
    hasChronicDisease: subject.hasChronicDisease,
    hasAircon: subject.hasAircon,
    airconBroken: subject.airconBroken,
    workerId: subject.workerId,
    workerName: subject.worker.name,
    workerPhone: subject.worker.phone,
    buildingId: subject.buildingId,
    building: subject.building,
    address,
    grade,
    gradeLabel: grade ? GRADE_LABEL[grade] : "평가 전",
    status,
    statusLabel: status ? HOUSEHOLD_STATUS_LABEL[status] : "상태 없음",
    reasons,
    feelsLikeMax: assessment?.alertDay.feelsLikeMax ?? null,
    date,
    workers,
    buildings,
    checks: subject.checkEvents.map((event) => ({
      id: event.id,
      date: event.alertDay.date,
      createdAt: DATE_TIME.format(event.createdAt)
        .replace(/\. (?=\d{2}:\d{2}$)/, " ")
        .replaceAll(". ", "."),
      workerName: event.worker.name,
      kind: event.kind === CheckKind.CALL || event.kind === CheckKind.VISIT
        ? CHECK_KIND_LABEL[event.kind]
        : "확인",
      result: checkResultLabel(event.kind, event.result),
      memo: event.memo,
    })),
  };
}

export type AdminSubjectDetail = NonNullable<Awaited<ReturnType<typeof getAdminSubjectDetail>>>;
