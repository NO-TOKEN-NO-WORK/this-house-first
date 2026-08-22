import { ageOf } from "../board/format";
import {
  CALL_RESULT_LABEL,
  CHECK_KIND_LABEL,
  CheckKind,
  HOUSEHOLD_STATUS_LABEL,
  HouseholdStatus,
  isAlertLevel,
  isCallResult,
  isOpenHouseholdStatus,
  isRiskGrade,
  isVisitResult,
  parseHouseholdStatus,
  RiskGrade,
  VISIT_RESULT_LABEL,
  WorkerRole,
} from "../domain";
import { parseAdminReasons } from "./dashboard";

const TIME = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Seoul",
});

interface WorkerDetailRow {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  subjects: Array<{
    id: string;
    name: string;
    phone: string | null;
    birthYear: number;
    livesAlone: boolean;
    hasAircon: boolean | null;
    airconBroken: boolean;
    building: {
      id: string;
      address: string;
      roadAddress: string | null;
      lat: number;
      lng: number;
      builtYear: number | null;
      isDetached: boolean;
      structure: string | null;
    };
    assessments: Array<{
      score: number;
      grade: number;
      reasons: string;
      alertDay: { level: string; feelsLikeMax: number };
    }>;
    dayStatuses: Array<{ status: string; updatedAt: Date }>;
  }>;
  checkEvents: Array<{
    id: string;
    kind: string;
    result: string;
    memo: string | null;
    createdAt: Date;
    alertDay: { date: string };
    subject: { id: string; name: string };
  }>;
}

function activityLabel(kind: string, result: string): string {
  if (kind === CheckKind.CALL && isCallResult(result)) {
    return `${CHECK_KIND_LABEL[CheckKind.CALL]} ${CALL_RESULT_LABEL[result]}`;
  }
  if (kind === CheckKind.VISIT && isVisitResult(result)) {
    return `${CHECK_KIND_LABEL[CheckKind.VISIT]} ${VISIT_RESULT_LABEL[result]}`;
  }
  return "확인 결과 확인 필요";
}

export function buildAdminWorkerDetail({
  date,
  worker,
}: {
  date: string;
  worker: WorkerDetailRow | null;
}) {
  if (!worker || worker.role !== WorkerRole.WORKER) return null;

  const subjects = worker.subjects.map((subject) => {
    const assessment = subject.assessments[0];
    const grade = assessment && isRiskGrade(assessment.grade)
      ? assessment.grade
      : null;
    const status = subject.dayStatuses[0]
      ? parseHouseholdStatus(subject.dayStatuses[0].status)
      : null;
    const address = subject.building.roadAddress ?? subject.building.address;

    return {
      id: subject.id,
      name: subject.name,
      phone: subject.phone,
      birthYear: subject.birthYear,
      age: ageOf(subject.birthYear, Number(date.slice(0, 4))),
      livesAlone: subject.livesAlone,
      hasAircon: subject.hasAircon,
      airconBroken: subject.airconBroken,
      building: subject.building,
      address,
      grade,
      score: assessment?.score ?? 0,
      reasons: assessment ? parseAdminReasons(assessment.reasons) : [],
      status,
      statusLabel: status ? HOUSEHOLD_STATUS_LABEL[status] : "상태 없음",
      open: status ? isOpenHouseholdStatus(status) : false,
    };
  }).sort((left, right) =>
    Number(right.open) - Number(left.open) ||
    (left.grade ?? 99) - (right.grade ?? 99) ||
    right.score - left.score ||
    left.name.localeCompare(right.name, "ko"),
  );

  const firstAddress = subjects[0]?.address.split(" ").filter(Boolean) ?? [];
  const regionParts = firstAddress[0]?.endsWith("도")
    ? firstAddress.slice(1, 3)
    : firstAddress.slice(0, 2);
  const region = regionParts.join(" ") || "전체 담당 지역";
  const organization = regionParts.at(-1)
    ? `${regionParts.at(-1)} 행정복지센터`
    : "소속 미등록";
  const firstAssessment = worker.subjects
    .flatMap((subject) => subject.assessments)
    .find((assessment) => isAlertLevel(assessment.alertDay.level));
  const stateTimes = worker.subjects.flatMap((subject) =>
    subject.dayStatuses.map((status) => status.updatedAt.getTime()),
  );
  const latestStateTime = stateTimes.length ? Math.max(...stateTimes) : null;

  return {
    id: worker.id,
    name: worker.name,
    phone: worker.phone,
    date,
    region,
    organization,
    feelsLikeMax: firstAssessment?.alertDay.feelsLikeMax ?? null,
    alertLevel: firstAssessment && isAlertLevel(firstAssessment.alertDay.level)
      ? firstAssessment.alertDay.level
      : null,
    workStatus: subjects.length ? "근무 중" : "휴식 중",
    lastStateChangedAt: latestStateTime === null
      ? null
      : TIME.format(new Date(latestStateTime)),
    summary: {
      openCritical: subjects.filter(
        (subject) => subject.open && subject.grade === RiskGrade.CRITICAL,
      ).length,
      visitQueued: subjects.filter(
        (subject) => subject.status === HouseholdStatus.VISIT_QUEUED,
      ).length,
      completed: subjects.filter(
        (subject) => subject.status !== null && !subject.open,
      ).length,
      coolingNeeded: subjects.filter(
        (subject) => subject.hasAircon === false || subject.airconBroken,
      ).length,
    },
    subjects,
    activities: worker.checkEvents.map((event) => ({
      id: event.id,
      subjectId: event.subject.id,
      subjectName: event.subject.name,
      label: activityLabel(event.kind, event.result),
      memo: event.memo,
      date: event.alertDay.date,
      time: TIME.format(event.createdAt),
    })),
  };
}

export async function getAdminWorkerDetail(
  workerId: string,
  date?: string,
) {
  const [{ prisma }, { todayInKst }] = await Promise.all([
    import("../db"),
    import("../board/today"),
  ]);
  const selectedDate = date ?? todayInKst();
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      subjects: {
        include: {
          building: true,
          assessments: {
            where: { alertDay: { date: selectedDate } },
            include: { alertDay: true },
            take: 1,
          },
          dayStatuses: {
            where: { alertDay: { date: selectedDate } },
            take: 1,
          },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      },
      checkEvents: {
        include: { alertDay: true, subject: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  return buildAdminWorkerDetail({ date: selectedDate, worker });
}

export type AdminWorkerDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminWorkerDetail>>
>;
