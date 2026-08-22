import { todayInKst } from "@/lib/board/today";
import { refreshWelfarePrograms } from "@/lib/public-data/welfare";
import {
  RecommendationStatus,
  recommendWelfarePrograms,
  WelfareIssue,
  type WelfareSignal,
  type WelfareSubjectProfile,
} from "@/lib/welfare-scan/eligibility";
import { extractWelfareSignals } from "@/lib/welfare-scan/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_DATA_PORTAL_FAILURES: Record<
  string,
  { message: string; reason: string }
> = {
  "20": {
    message: "공공데이터 활용신청 오류",
    reason: "공공데이터 활용신청이 승인되지 않았거나 중지되었습니다.",
  },
  "22": {
    message: "공공데이터 호출 한도 초과",
    reason: "공공데이터 개발계정의 일일 호출 한도를 초과했습니다.",
  },
  "30": {
    message: "공공데이터 인증 오류",
    reason: "등록되지 않은 공공데이터 서비스키입니다.",
  },
};

async function getSubjectProfiles(): Promise<WelfareSubjectProfile[]> {
  const { prisma } = await import("@/lib/db");
  const year = Number(todayInKst().slice(0, 4));
  const subjects = await prisma.subject.findMany({
    where: { archivedAt: null, worker: { archivedAt: null } },
    select: {
      id: true,
      name: true,
      birthYear: true,
      livesAlone: true,
      hasAircon: true,
      airconBroken: true,
      worker: { select: { name: true } },
      checkEvents: {
        where: { memo: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { memo: true },
      },
    },
    orderBy: [{ worker: { name: "asc" } }, { name: "asc" }],
  });
  return subjects.map((subject) => ({
    subjectId: subject.id,
    name: subject.name,
    age: year - subject.birthYear,
    livesAlone: subject.livesAlone,
    hasAircon: subject.hasAircon,
    airconBroken: subject.airconBroken,
    workerName: subject.worker.name,
    latestMemo: subject.checkEvents[0]?.memo?.trim() || null,
  }));
}

function structuredFallbackSignals(
  profiles: WelfareSubjectProfile[],
): WelfareSignal[] {
  return profiles.map((profile) => {
    const coolingIssue = profile.hasAircon === false || profile.airconBroken;
    return {
      subjectId: profile.subjectId,
      issues: coolingIssue ? [WelfareIssue.COOLING_ISSUE] : [],
      evidence: coolingIssue
        ? [profile.airconBroken ? "냉방기기 고장 기록" : "냉방기기 없음 기록"]
        : [],
    };
  });
}

function connectionFailureMessage(
  error: unknown,
  service: "publicData" | "ai",
): string {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
  const message = error instanceof Error ? error.message : "";
  const portalFailure = service === "publicData"
    ? PUBLIC_DATA_PORTAL_FAILURES[code]
    : undefined;
  if (portalFailure) return portalFailure.message;
  if (code === "MISSING_SERVICE_KEY" || code === "MISSING_AI_GATEWAY_AUTH") {
    return service === "publicData" ? "공공데이터 API 키 미설정" : "AI Gateway 인증 미설정";
  }
  if (message.includes("시간")) {
    return service === "publicData" ? "공공데이터 응답 시간 초과" : "AI 분석 응답 시간 초과";
  }
  if ([
    "UPSTREAM_HTTP_ERROR",
    "UPSTREAM_API_ERROR",
    "UPSTREAM_AUTH_ERROR",
    "INVALID_UPSTREAM_RESPONSE",
    "OPENAI_HTTP_ERROR",
    "INVALID_OPENAI_RESPONSE",
    "INCOMPLETE_OPENAI_RESPONSE",
    "OPENAI_REFUSAL",
  ].includes(code)) {
    return service === "publicData" ? "공공데이터 응답 오류" : "AI 분석 응답 오류";
  }
  return service === "publicData" ? "공공데이터 연결 실패" : "AI 분석 연결 실패";
}

function connectionFailureReason(
  error: unknown,
  service: "publicData" | "ai",
  message: string,
): string {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
  const portalFailure = service === "publicData"
    ? PUBLIC_DATA_PORTAL_FAILURES[code]
    : undefined;
  if (portalFailure) return portalFailure.reason;
  if (message.endsWith("API 키 미설정")) {
    return "PUBLIC_DATA_SERVICE_KEY 환경변수가 설정되지 않았습니다.";
  }
  if (message === "AI Gateway 인증 미설정") {
    return "Vercel OIDC 또는 AI_GATEWAY_API_KEY 인증이 필요합니다.";
  }
  if (message.endsWith("응답 시간 초과")) {
    return service === "publicData"
      ? "복지서비스 API 응답 시간이 초과되었습니다."
      : "AI 분석 응답 시간이 초과되었습니다.";
  }
  if (["UPSTREAM_HTTP_ERROR", "OPENAI_HTTP_ERROR"].includes(code)) {
    const status = error instanceof Error ? error.message.match(/HTTP (\d{3})/)?.[1] : null;
    const particle = status && /[013678]$/.test(status) ? "으로" : "로";
    return status
      ? `${service === "publicData" ? "복지서비스 API" : "AI 분석 서비스"}가 HTTP ${status}${particle} 응답했습니다.`
      : "외부 서비스가 오류 응답을 반환했습니다.";
  }
  if (["UPSTREAM_API_ERROR", "UPSTREAM_AUTH_ERROR", "INVALID_UPSTREAM_RESPONSE"].includes(code)) {
    return "복지서비스 API 응답 형식이 올바르지 않았습니다.";
  }
  if (["INVALID_OPENAI_RESPONSE", "INCOMPLETE_OPENAI_RESPONSE", "OPENAI_REFUSAL"].includes(code)) {
    return "AI 분석 결과 형식이 올바르지 않았습니다.";
  }
  return "외부 서비스 처리 중 예상하지 못한 오류가 발생했습니다.";
}

function connectionFailureState(
  error: unknown,
  service: "publicData" | "ai",
): { ok: false; message: string; reason: string } {
  const message = connectionFailureMessage(error, service);
  return {
    ok: false,
    message,
    reason: connectionFailureReason(error, service, message),
  };
}

export async function GET(): Promise<Response> {
  try {
    const programs = await refreshWelfarePrograms();
    return Response.json({
      data: { count: programs.length, syncedAt: new Date().toISOString() },
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
    return Response.json(
      {
        error: {
          code: "WELFARE_SYNC_FAILED",
          message: connectionFailureMessage(error, "publicData"),
        },
      },
      { status: code === "MISSING_SERVICE_KEY" ? 503 : 502 },
    );
  }
}

export async function POST(): Promise<Response> {
  try {
    const profiles = await getSubjectProfiles();
    if (profiles.length === 0) {
      return Response.json({
        data: {
          recommendations: [],
          scannedCount: 0,
          programCount: 0,
          partial: false,
          scannedAt: new Date().toISOString(),
          connections: {
            publicData: { ok: true, message: "공공데이터 연결 정상" },
            ai: { ok: true, message: "AI 분석 연결 정상" },
          },
        },
      });
    }

    const [programResult, signalResult] = await Promise.allSettled([
      refreshWelfarePrograms(),
      extractWelfareSignals(profiles),
    ]);
    const programs = programResult.status === "fulfilled" ? programResult.value : [];
    const signals = signalResult.status === "fulfilled"
      ? signalResult.value
      : structuredFallbackSignals(profiles);
    const signalBySubject = new Map(
      signals.map((signal) => [signal.subjectId, signal]),
    );
    const recommendations = profiles.flatMap((profile) =>
      recommendWelfarePrograms({
        profile,
        signal: signalBySubject.get(profile.subjectId) ?? {
          subjectId: profile.subjectId,
          issues: [],
          evidence: [],
        },
        programs,
      }),
    );

    return Response.json({
      data: {
        recommendations,
        scannedCount: profiles.length,
        programCount: programs.length,
        partial:
          programResult.status === "rejected" || signalResult.status === "rejected",
        scannedAt: new Date().toISOString(),
        summary: {
          high: recommendations.filter(
            (item) => item.status === RecommendationStatus.HIGH,
          ).length,
          needsInfo: recommendations.filter(
            (item) => item.status === RecommendationStatus.NEEDS_INFO,
          ).length,
        },
        connections: {
          publicData: programResult.status === "fulfilled"
            ? { ok: true, message: "공공데이터 연결 정상" }
            : connectionFailureState(programResult.reason, "publicData"),
          ai: signalResult.status === "fulfilled"
            ? { ok: true, message: "AI 분석 연결 정상" }
            : connectionFailureState(signalResult.reason, "ai"),
        },
      },
    });
  } catch (error) {
    console.error("복지 스캔 실행 실패", error);
    return Response.json(
      {
        error: {
          code: "WELFARE_SCAN_FAILED",
          message: "복지 스캔을 실행하지 못했습니다.",
        },
      },
      { status: 500 },
    );
  }
}
