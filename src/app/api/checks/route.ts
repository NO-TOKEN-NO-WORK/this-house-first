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

type ParsedCheck =
  | { kind: typeof CheckKind.CALL; result: CallResult }
  | { kind: typeof CheckKind.VISIT; result: VisitResult };

function parseCheck(kind: unknown, result: unknown): ParsedCheck {
  if (!isCheckKind(kind)) {
    throw badRequest("kind는 CALL 또는 VISIT이어야 합니다.");
  }
  if (kind === CheckKind.CALL) {
    if (!isCallResult(result)) {
      throw badRequest(
        "전화 결과는 OK · NO_ANSWER · SYMPTOM · UNREACHABLE 중 하나여야 합니다.",
      );
    }
    return { kind, result };
  }
  if (!isVisitResult(result)) {
    throw badRequest(
      "방문 결과는 OK · ACTED · EMERGENCY_119 · AIRCON_ISSUE 중 하나여야 합니다.",
    );
  }
  return { kind, result };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);

    const subjectId = requiredId(body.subjectId, "subjectId");
    // 전화·방문 결과는 문자열 값이 일부 겹치므로(OK 등) kind별로 따로 좁힌다
    const check = parseCheck(body.kind, body.result);
    const memo = optionalMemo(body.memo);
    const date = optionalIsoDate(body.date) ?? todayInKst();
    const requestedWorkerId = optionalId(body.workerId, "workerId");
    const now = new Date();

    const outcome = await prisma.$transaction(async (tx) => {
      const alertDay = await tx.alertDay.findUnique({ where: { date } });
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
      const statusRow = await tx.householdDayStatus.findUnique({ where: key });
      if (!statusRow) {
        throw notFound(
          "해당 경보일의 대상자 가구를 찾지 못했습니다.",
          "HOUSEHOLD_NOT_FOUND",
        );
      }

      const worker = requestedWorkerId
        ? await tx.worker.findUnique({ where: { id: requestedWorkerId } })
        : await tx.worker.findFirst({ where: { role: WorkerRole.WORKER } });
      if (!worker) {
        throw notFound("기록할 담당자를 찾지 못했습니다.", "WORKER_NOT_FOUND");
      }

      const current = parseHouseholdStatus(statusRow.status);
      const next =
        check.kind === CheckKind.CALL
          ? transition({
              current,
              callAttempts: statusRow.callAttempts,
              kind: check.kind,
              result: check.result,
              now,
              lastCallAt:
                (
                  await tx.checkEvent.findFirst({
                    where: {
                      alertDayId: alertDay.id,
                      subjectId,
                      kind: CheckKind.CALL,
                    },
                    orderBy: { createdAt: "desc" },
                    select: { createdAt: true },
                  })
                )?.createdAt ?? null,
            })
          : transition({
              current,
              callAttempts: statusRow.callAttempts,
              kind: check.kind,
              result: check.result,
            });

      // 읽은 상태가 그대로일 때만 갱신한다. 동시 요청이 같은 callAttempts를 덮어쓰는 것을 막는다.
      const updated = await tx.householdDayStatus.updateMany({
        where: { id: statusRow.id, updatedAt: statusRow.updatedAt },
        data: {
          status: next.status,
          callAttempts: next.callAttempts,
          ...(next.promoted ? { promotedAt: now } : {}),
        },
      });
      if (updated.count !== 1) {
        throw conflict(
          "다른 기록이 먼저 반영되었습니다. 최신 상태를 확인한 뒤 다시 시도하세요.",
          "STALE_HOUSEHOLD_STATUS",
        );
      }

      await tx.checkEvent.create({
        data: {
          alertDayId: alertDay.id,
          subjectId,
          workerId: worker.id,
          kind: check.kind,
          result: check.result,
          memo: memo ?? null,
          createdAt: now,
        },
      });

      if (next.airconIssue) {
        // 익일 위험도 가중(FR-8) + 지원사업 연계 플래그(FR-11)
        await tx.subject.update({
          where: { id: subjectId },
          data: { airconBroken: true, hasAircon: false },
        });
      }

      return next;
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
