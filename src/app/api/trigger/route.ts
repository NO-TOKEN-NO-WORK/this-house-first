import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  DEMO_HEAT_TEMPERATURE,
  isAlertLevel,
} from "@/lib/domain";
import {
  invalidParameter,
  toPublicDataErrorResponse,
} from "@/lib/public-data/client";
import { getHeatForecast } from "@/lib/public-data/kma";
import { toIsoDate } from "@/lib/trigger/alert-date";
import {
  declareTrigger,
  resetDemoTrigger,
  TriggerError,
} from "@/lib/trigger/declare";
import { dispatchDueNotifications } from "@/lib/notifications/push";

/**
 * F1 트리거 (FR-1)
 *
 *  - `GET`  판정만 한다. DB를 건드리지 않는 미리보기 — 예보 확인용
 *  - `POST` 발령한다. 경보일이면 AlertDay + 당일 평가 + 가구 상태를 만든다(FR-3).
 *           임계값 미달이면 아무것도 만들지 않는다 (침묵이 스펙 — PRD §9)
 *
 * 관리자 화면의 수동 시뮬레이션(ADR-0011)은 POST에 `level` 또는 `feelsLikeMax`를 보낸다.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gridCoordinate(value: string | null, name: string): number {
  if (!value || !/^\d{1,3}$/.test(value)) {
    throw invalidParameter(`${name}는 1~3자리 기상청 격자좌표여야 합니다.`);
  }
  return Number(value);
}

function optionalDate(value: string | null, name: string): string | undefined {
  if (value == null) return undefined;
  if (!/^\d{8}$/.test(value)) {
    throw invalidParameter(`${name}는 YYYYMMDD 형식이어야 합니다.`);
  }
  try {
    toIsoDate(value);
  } catch {
    throw invalidParameter(`${name}는 실제 달력에 존재하는 날짜여야 합니다.`);
  }
  return value;
}

function checkBaseTime(baseDate?: string, baseTime?: string): void {
  if (baseTime && !/^(02|05|08|11|14|17|20|23)00$/.test(baseTime)) {
    throw invalidParameter("baseTime은 단기예보 발표시각(HH00)이어야 합니다.");
  }
  if ((baseDate == null) !== (baseTime == null)) {
    throw invalidParameter("baseDate와 baseTime은 함께 지정해야 합니다.");
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams;
    const baseDate = optionalDate(query.get("baseDate"), "baseDate");
    const baseTime = query.get("baseTime") ?? undefined;
    checkBaseTime(baseDate, baseTime);

    const forecast = await getHeatForecast({
      nx: gridCoordinate(query.get("nx"), "nx"),
      ny: gridCoordinate(query.get("ny"), "ny"),
      targetDate: optionalDate(query.get("targetDate"), "targetDate"),
      baseDate,
      baseTime,
    });
    return Response.json({ data: forecast });
  } catch (error) {
    return toPublicDataErrorResponse(error);
  }
}

/** JSON 본문(선택) — 없으면 쿼리스트링만으로도 동작한다 (curl 시연 편의) */
async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw invalidParameter("요청 본문은 JSON 객체여야 합니다.");
  }
  return parsed as Record<string, unknown>;
}

function asString(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  return null;
}

function optionalTemperature(raw: unknown, name: string): number | undefined {
  if (raw == null) return undefined;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value < -60 || value > 60) {
    throw invalidParameter(`${name}는 -60~60 사이의 체감온도여야 합니다.`);
  }
  return value;
}

function optionalLevel(raw: unknown): AlertLevel | undefined {
  if (raw == null) return undefined;
  if (!isAlertLevel(raw)) {
    throw invalidParameter(
      `level은 ADVISORY(${ALERT_LEVEL_LABEL.ADVISORY}) · WARNING(${ALERT_LEVEL_LABEL.WARNING}) · EMERGENCY(${ALERT_LEVEL_LABEL.EMERGENCY}) 중 하나여야 합니다.`,
    );
  }
  return raw;
}

function optionalRegionCode(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const value = asString(raw);
  if (value == null || !/^\d{10}$/.test(value)) {
    throw invalidParameter("regionCode는 10자리 행정구역코드여야 합니다.");
  }
  return value;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams;
    const body = await readJsonBody(request);
    const field = (name: string): unknown =>
      Object.prototype.hasOwnProperty.call(body, name)
        ? body[name]
        : query.get(name) ?? undefined;

    const baseDate = optionalDate(asString(field("baseDate")), "baseDate");
    const baseTime = asString(field("baseTime")) ?? undefined;
    checkBaseTime(baseDate, baseTime);

    const nxRaw = asString(field("nx"));
    const nyRaw = asString(field("ny"));
    const demo = field("demo") === true;

    const outcome = await declareTrigger({
      nx: nxRaw == null ? undefined : gridCoordinate(nxRaw, "nx"),
      ny: nyRaw == null ? undefined : gridCoordinate(nyRaw, "ny"),
      targetDate: optionalDate(asString(field("targetDate")), "targetDate"),
      baseDate,
      baseTime,
      level: demo ? AlertLevel.EMERGENCY : optionalLevel(field("level")),
      feelsLikeMax: demo
        ? DEMO_HEAT_TEMPERATURE
        : optionalTemperature(field("feelsLikeMax"), "feelsLikeMax"),
      demo,
      regionCode: optionalRegionCode(field("regionCode")),
    });

    // 수동 데모 요약과 재발령 승격은 즉시, 예보 요약은 availableAt(08:00 KST) 이후에 전달된다.
    const push = outcome.alerted
      ? await dispatchDueNotifications({ alertDayId: outcome.alertDayId }).catch(
          (error: unknown) => {
            console.error("[notifications] 경보 Push 전달 실패", error);
            return null;
          },
        )
      : null;

    return Response.json({ data: outcome, push });
  } catch (error) {
    if (error instanceof TriggerError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    return toPublicDataErrorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams;
    const body = await readJsonBody(request);
    const rawTargetDate = Object.prototype.hasOwnProperty.call(body, "targetDate")
      ? body.targetDate
      : query.get("targetDate");
    const targetDate = optionalDate(asString(rawTargetDate), "targetDate");
    if (!targetDate) {
      throw invalidParameter("targetDate는 YYYYMMDD 형식으로 보내야 합니다.");
    }

    return Response.json({ data: await resetDemoTrigger(targetDate) });
  } catch (error) {
    if (error instanceof TriggerError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    return toPublicDataErrorResponse(error);
  }
}
