import { prisma } from "@/lib/db";
import {
  type CallResult,
  CheckKind,
  HOUSEHOLD_STATUS_LABEL,
  isCallResult,
  isCheckKind,
  isVisitResult,
  parseHouseholdStatus,
  type VisitResult,
  WorkerRole,
} from "@/lib/domain";
import { todayInKst } from "@/lib/board/today";
import {
  badRequest,
  conflict,
  notFound,
  optionalId,
  optionalIsoDate,
  readJsonObject,
  requiredId,
  toErrorResponse,
} from "@/lib/http";
import { transition, TransitionError } from "@/lib/escalation/transition";

/**
 * 확인 기록 (FR-5) — 전화·방문 결과 원터치 기록.
 *
 * `POST /api/checks { subjectId, kind: "CALL"|"VISIT", result, memo?, date?, workerId? }`
 *
 * 기록 원장(CheckEvent)을 남기고 상태머신 전이 결과를 HouseholdDayStatus에 반영한다.
 * 전이 규칙 자체는 순수 함수(`src/lib/escalation/transition.ts`)가 갖고 있다.
 *
 * v0에는 인증이 없어(ADR-0008 범위 밖) workerId를 생략하면 담당자 계정을 자동 선택한다.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function optionalMemo(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || value.length > 500) {
    throw badRequest("memo는 500자 이하 문자열이어야 합니다.");
  }
  return value.trim() || undefined;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);

    const subjectId = requiredId(body.subjectId, "subjectId");
    const kind = body.kind;
    if (!isCheckKind(kind)) {
      throw badRequest("kind는 CALL 또는 VISIT이어야 합니다.");
    }
    // 전화·방문 결과는 문자열 값이 일부 겹치므로(OK 등) kind별로 따로 좁힌다
    const rawResult: unknown = body.result;
    let result: CallResult | VisitResult;
    if (kind === CheckKind.CALL) {
      if (!isCallResult(rawResult)) {
        throw badRequest(
          "전화 결과는 OK · NO_ANSWER · SYMPTOM · UNREACHABLE 중 하나여야 합니다.",
        );
      }
      result = rawResult;
    } else {
      if (!isVisitResult(rawResult)) {
        throw badRequest(
          "방문 결과는 OK · ACTED · EMERGENCY_119 · AIRCON_ISSUE 중 하나여야 합니다.",
        );
      }
      result = rawResult;
    }
    const memo = optionalMemo(body.memo);
    const date = optionalIsoDate(body.date) ?? todayInKst();
    const requestedWorkerId = optionalId(body.workerId, "workerId");

    const alertDay = await prisma.alertDay.findUnique({ where: { date } });
    if (!alertDay) {
      // 비경보일에는 기록할 대상이 없다 — 발령이 먼저다
      throw conflict(
        `${date}은 경보일이 아닙니다. /api/trigger로 발령한 뒤 기록할 수 있습니다.`,
        "NOT_ALERT_DAY",
      );
    }

    const key = {
      alertDayId_subjectId: { alertDayId: alertDay.id, subjectId },
    };
    const statusRow = await prisma.householdDayStatus.findUnique({
      where: key,
    });
    if (!statusRow) {
      throw notFound(
        "해당 경보일의 대상자 가구를 찾지 못했습니다.",
        "HOUSEHOLD_NOT_FOUND",
      );
    }

    const worker = requestedWorkerId
      ? await prisma.worker.findUnique({ where: { id: requestedWorkerId } })
      : await prisma.worker.findFirst({ where: { role: WorkerRole.WORKER } });
    if (!worker) {
      throw notFound("기록할 담당자를 찾지 못했습니다.", "WORKER_NOT_FOUND");
    }

    const outcome = transition({
      current: parseHouseholdStatus(statusRow.status),
      callAttempts: statusRow.callAttempts,
      kind,
      result,
    });

    await prisma.$transaction(async (tx) => {
      await tx.checkEvent.create({
        data: {
          alertDayId: alertDay.id,
          subjectId,
          workerId: worker.id,
          kind,
          result,
          memo: memo ?? null,
        },
      });

      await tx.householdDayStatus.update({
        where: key,
        data: {
          status: outcome.status,
          callAttempts: outcome.callAttempts,
          ...(outcome.promoted ? { promotedAt: new Date() } : {}),
        },
      });

      if (outcome.airconIssue) {
        // 익일 위험도 가중(FR-8) + 지원사업 연계 플래그(FR-11)
        await tx.subject.update({
          where: { id: subjectId },
          data: { airconBroken: true, hasAircon: false },
        });
      }
    });

    return Response.json({
      data: {
        subjectId,
        date,
        status: outcome.status,
        statusLabel: HOUSEHOLD_STATUS_LABEL[outcome.status],
        callAttempts: outcome.callAttempts,
        promoted: outcome.promoted,
        airconIssue: outcome.airconIssue,
      },
    });
  } catch (error) {
    if (error instanceof TransitionError) {
      return toErrorResponse(conflict(error.message, error.code));
    }
    return toErrorResponse(error);
  }
}
