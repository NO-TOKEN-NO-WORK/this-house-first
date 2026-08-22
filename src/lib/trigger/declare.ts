import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "../db";
import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  GRADE_LABEL,
  HouseholdStatus,
  NotificationCause,
  NotificationType,
  parseHouseholdStatus,
  RiskGrade,
  WorkerRole,
} from "../domain";
import { resolveStatusOnDeclare } from "../escalation/initial";
import {
  alertMorningAt,
  type NotificationDraft,
  visitPromotedDraft,
} from "../notifications/message";
import {
  morningSummaryDrafts,
  reclassificationRecipientIds,
} from "../notifications/policy";
import { formatKstDate, getHeatForecast } from "../public-data/kma";
import { assessRisk } from "../scoring/score";
import { LEVEL_MIN_FEELS_LIKE } from "../scoring/weights";
import { toIsoDate, yearOfCompactDate } from "./alert-date";
import { classifyHeatAlert } from "./heat";

/**
 * 경보일 발령 (FR-1 → FR-3) — 트리거 판정부터 당일 평가·가구 상태 생성까지.
 *
 * 핵심 원칙 두 가지:
 *  1. **침묵이 스펙**: 임계값 미달이면 AlertDay를 만들지 않는다. 비경보일에는 행이 아예
 *     없어야 알림 0건이 보장된다 (PRD §9, schema.prisma AlertDay 주석).
 *  2. **재발령 안전**: 같은 날 다시 발령해도 이미 진행된 확인 기록을 덮어쓰지 않는다
 *     (escalation/initial.ts resolveStatusOnDeclare).
 *
 * 판정 자체는 순수 함수(classifyHeatAlert)가, 나이 계산 기준 연도는 경보일 연도가 담당한다.
 */

export type TriggerSource = "forecast" | "manual";

export class TriggerError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "TriggerError";
  }
}

export interface TriggerInput {
  /** 기상청 격자좌표 — 예보 조회 모드에서 필수 */
  nx?: number;
  ny?: number;
  /** 대상 날짜 YYYYMMDD (KST). 생략 시 익일 */
  targetDate?: string;
  /** 단기예보 발표시각 지정 (과거 발표분 재현용) */
  baseDate?: string;
  baseTime?: string;
  /** 수동 발령 단계 — 데모 시뮬레이션 (ADR-0011) */
  level?: AlertLevel;
  /** 수동 발령 체감온도. level 없이 이 값만 주면 실제 판정 로직을 태운다 */
  feelsLikeMax?: number;
  /** 읍면동 코드 (선택) */
  regionCode?: string | null;
}

interface OutcomeBase {
  source: TriggerSource;
  /** "YYYY-MM-DD" (KST) */
  targetDate: string;
}

export interface SilentOutcome extends OutcomeBase {
  alerted: false;
  level: null;
  feelsLikeMax: number | null;
  /** 침묵 사유 — 관리자 화면에 그대로 표시 */
  reason: string;
}

export interface AlertedOutcome extends OutcomeBase {
  alerted: true;
  alertDayId: string;
  level: AlertLevel;
  feelsLikeMax: number;
  subjectCount: number;
  /** 위험 단계별 인원 — 심각 수가 그날 방문해야 할 가구 수다 */
  gradeCounts: Record<RiskGrade, number>;
  /** 방문 큐에 새로 올라간 가구 수 */
  visitQueued: number;
  /** 재발령에서 기존 상태를 보존한 가구 수 */
  preserved: number;
}

export type TriggerOutcome = SilentOutcome | AlertedOutcome;

/** 트리거 판정 → 경보일이면 발령까지. 관리자 수동 시뮬레이션과 실제 예보가 같은 경로를 탄다 */
export async function declareTrigger(
  input: TriggerInput,
  deps: { client?: PrismaClient; now?: Date } = {},
): Promise<TriggerOutcome> {
  const now = deps.now ?? new Date();
  const manual = input.level != null || input.feelsLikeMax != null;

  let source: TriggerSource;
  let compactDate: string;
  let level: AlertLevel | null;
  let feelsLikeMax: number | null;

  if (manual) {
    source = "manual";
    compactDate = input.targetDate ?? formatKstDate(now, 1);
    // level을 직접 주면 그대로, 체감온도만 주면 실제 판정 함수를 태운다 (ADR-0011)
    level = input.level ?? classifyHeatAlert(input.feelsLikeMax as number);
    feelsLikeMax =
      input.feelsLikeMax ?? (level == null ? null : LEVEL_MIN_FEELS_LIKE[level]);
  } else {
    source = "forecast";
    if (input.nx == null || input.ny == null) {
      throw new TriggerError(
        "예보 조회에는 기상청 격자좌표(nx, ny)가 필요합니다. 수동 발령은 level 또는 feelsLikeMax를 주세요.",
        "MISSING_GRID",
      );
    }
    const forecast = await getHeatForecast(
      {
        nx: input.nx,
        ny: input.ny,
        targetDate: input.targetDate,
        baseDate: input.baseDate,
        baseTime: input.baseTime,
      },
      { now },
    );
    compactDate = forecast.targetDate;
    level = forecast.level;
    feelsLikeMax = forecast.maxFeelsLikeTemperature;
  }

  const date = toIsoDate(compactDate);

  if (level == null) {
    // 침묵 — AlertDay를 만들지 않는다. 기존 경보일이 있어도 건드리지 않는다(취소는 별도 결정 사항)
    return {
      alerted: false,
      source,
      targetDate: date,
      level: null,
      feelsLikeMax,
      reason:
        feelsLikeMax == null
          ? "임계값 미달 — 경보 없음"
          : `최고 체감 ${feelsLikeMax}도로 임계값 미달 — 경보 없음`,
    };
  }

  return declareAlertDay(
    { date, level, feelsLikeMax: feelsLikeMax ?? LEVEL_MIN_FEELS_LIKE[level], regionCode: input.regionCode, source },
    deps.client ?? prisma,
    now,
  );
}

async function declareAlertDay(
  input: {
    date: string;
    level: AlertLevel;
    feelsLikeMax: number;
    regionCode?: string | null;
    source: TriggerSource;
  },
  client: PrismaClient,
  now: Date,
): Promise<AlertedOutcome> {
  const { date, level, feelsLikeMax, source } = input;
  const year = yearOfCompactDate(date.replaceAll("-", ""));

  const subjects = await client.subject.findMany({
    where: { archivedAt: null, worker: { archivedAt: null } },
    include: { building: true },
    orderBy: { id: "asc" },
  });
  if (subjects.length === 0) {
    throw new TriggerError(
      "대상자가 없습니다. `npm run db:seed`로 시드를 먼저 실행하세요.",
      "NO_SUBJECTS",
      409,
    );
  }

  return client.$transaction(async (tx) => {
    const alertDay = await tx.alertDay.upsert({
      where: { date },
      create: { date, level, feelsLikeMax, regionCode: input.regionCode ?? null },
      update: {
        level,
        feelsLikeMax,
        ...(input.regionCode === undefined
          ? {}
          : { regionCode: input.regionCode }),
      },
    });

    const gradeCounts: Record<RiskGrade, number> = { 1: 0, 2: 0, 3: 0 };
    const notificationDrafts: NotificationDraft[] = [];
    const assessedRecipients: Array<{ workerId: string; grade: RiskGrade }> = [];
    const managers = await tx.worker.findMany({
      where: { role: WorkerRole.MANAGER, archivedAt: null },
      select: { id: true },
    });
    let visitQueued = 0;
    let preserved = 0;

    for (const subject of subjects) {
      const risk = assessRisk({
        subject,
        building: subject.building,
        level,
        feelsLikeMax,
        year,
      });
      gradeCounts[risk.grade] += 1;
      assessedRecipients.push({ workerId: subject.workerId, grade: risk.grade });

      const key = { alertDayId_subjectId: { alertDayId: alertDay.id, subjectId: subject.id } };

      // 당일 평가 스냅샷 — reasons는 UI가 그대로 표시한다 (설명 가능성, PRD F3)
      await tx.riskAssessment.upsert({
        where: key,
        create: {
          alertDayId: alertDay.id,
          subjectId: subject.id,
          score: risk.score,
          grade: risk.grade,
          reasons: JSON.stringify(risk.reasons),
        },
        update: {
          score: risk.score,
          grade: risk.grade,
          reasons: JSON.stringify(risk.reasons),
        },
      });

      const existing = await tx.householdDayStatus.findUnique({ where: key });
      const current = existing ? parseHouseholdStatus(existing.status) : null;
      const next = resolveStatusOnDeclare(current, risk.grade);

      if (next === null) {
        preserved += 1;
        continue;
      }
      if (next === HouseholdStatus.VISIT_QUEUED) visitQueued += 1;

      if (existing) {
        await tx.householdDayStatus.update({
          where: key,
          data: { status: next, promotedAt: now },
        });

        // 새 경보일의 초기 심각 대상자는 아침 요약에만 포함한다. 이미 있던 미확인 가구가
        // 재발령으로 심각 단계가 된 경우만 새로운 승격 사건이다 (ADR-0017).
        const recipientIds = reclassificationRecipientIds({
          current,
          next,
          workerId: subject.workerId,
          managerIds: managers.map(({ id }) => id),
        });
        for (const recipientId of recipientIds) {
          notificationDrafts.push(
            visitPromotedDraft({
              alertDayId: alertDay.id,
              date,
              recipientId,
              subjectId: subject.id,
              subjectName: subject.name,
              workerId: subject.workerId,
              cause: NotificationCause.RISK_RECLASSIFIED,
              availableAt: now,
            }),
          );
        }
      } else {
        await tx.householdDayStatus.create({
          data: {
            alertDayId: alertDay.id,
            subjectId: subject.id,
            status: next,
            promotedAt: next === HouseholdStatus.VISIT_QUEUED ? now : null,
          },
        });
      }
    }

    const summaryAvailableAt =
      source === "manual" ? now : alertMorningAt(date);
    notificationDrafts.push(
      ...morningSummaryDrafts({
        alertDayId: alertDay.id,
        date,
        level,
        availableAt: summaryAvailableAt,
        subjects: assessedRecipients,
      }),
    );
    for (const draft of notificationDrafts) {
      await tx.notification.upsert({
        where: { eventKey: draft.eventKey },
        create: draft,
        // 자동 재예보는 한 건인 채 최신 내용만 고친다. 관제 센터의 수동 발령은 명시적인
        // 재전송 요청이므로 담당자 요약만 Push 상태를 초기화하고, 승격 알림은 중복하지 않는다.
        update: {
          cause: draft.cause,
          title: draft.title,
          body: draft.body,
          href: draft.href,
          availableAt: draft.availableAt,
          expiresAt: draft.expiresAt,
          ...(source === "manual" &&
          draft.type === NotificationType.ALERT_DAY_SUMMARY
            ? {
                pushClaimedAt: null,
                pushSentAt: null,
                pushAttempts: 0,
                lastPushError: null,
              }
            : {}),
        },
      });
    }

    console.log(
      `[trigger] ${date} ${ALERT_LEVEL_LABEL[level]} 발령(${source}) — 대상자 ${subjects.length}명, ` +
        `${GRADE_LABEL[RiskGrade.CRITICAL]} ${gradeCounts[1]} · ${GRADE_LABEL[RiskGrade.HIGH]} ${gradeCounts[2]} · ${GRADE_LABEL[RiskGrade.MODERATE]} ${gradeCounts[3]}, 방문 큐 ${visitQueued}`,
    );

    return {
      alerted: true,
      source,
      targetDate: date,
      alertDayId: alertDay.id,
      level,
      feelsLikeMax,
      subjectCount: subjects.length,
      gradeCounts,
      visitQueued,
      preserved,
    };
  }, { timeout: 15_000 });
}
