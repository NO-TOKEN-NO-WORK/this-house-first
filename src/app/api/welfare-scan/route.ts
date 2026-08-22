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

async function getSubjectProfiles(): Promise<WelfareSubjectProfile[]> {
  const { prisma } = await import("@/lib/db");
  const year = Number(todayInKst().slice(0, 4));
  const subjects = await prisma.subject.findMany({
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
  if (code === "MISSING_SERVICE_KEY" || code === "MISSING_OPENAI_API_KEY") {
    return service === "publicData" ? "공공데이터 API 키 미설정" : "AI API 키 미설정";
  }
  if (message.includes("시간")) {
    return service === "publicData" ? "공공데이터 응답 시간 초과" : "AI 분석 응답 시간 초과";
  }
  if (code.includes("HTTP") || code.includes("UPSTREAM")) {
    return service === "publicData" ? "공공데이터 응답 오류" : "AI 분석 응답 오류";
  }
  return service === "publicData" ? "공공데이터 연결 실패" : "AI 분석 연결 실패";
}

function connectionFailureState(
  error: unknown,
  service: "publicData" | "ai",
): { ok: false; message: string; reason: string } {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
  return {
    ok: false,
    message: connectionFailureMessage(error, service),
    reason: code && error instanceof Error && error.message.trim()
      ? error.message
      : "외부 서비스 처리 중 예상하지 못한 오류가 발생했습니다.",
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
