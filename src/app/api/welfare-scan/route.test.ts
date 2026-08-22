import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  refreshWelfarePrograms: vi.fn(),
  extractWelfareSignals: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { subject: { findMany: mocks.findMany } },
}));
vi.mock("@/lib/public-data/welfare", () => ({
  refreshWelfarePrograms: mocks.refreshWelfarePrograms,
}));
vi.mock("@/lib/welfare-scan/openai", () => ({
  extractWelfareSignals: mocks.extractWelfareSignals,
}));

import { GET, POST } from "./route";

describe("POST /api/welfare-scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([
      {
        id: "subject-1",
        name: "김○○",
        birthYear: 1938,
        livesAlone: true,
        hasAircon: false,
        airconBroken: true,
        worker: { name: "이미경" },
        checkEvents: [{ memo: "에어컨에서 미지근한 바람만 나옵니다." }],
      },
    ]);
    mocks.refreshWelfarePrograms.mockResolvedValue([
      {
        id: "energy-1",
        name: "저소득층 에너지효율개선사업",
        ministry: "기후에너지환경부",
        summary: "냉방기기와 단열 개선을 지원합니다.",
        selectionCriteria: "기초생활수급자 또는 차상위계층",
        target: "저소득 노인가구",
        link: "https://www.bokjiro.go.kr/energy",
      },
    ]);
    mocks.extractWelfareSignals.mockResolvedValue([
      {
        subjectId: "subject-1",
        issues: ["COOLING_ISSUE"],
        evidence: ["에어컨에서 미지근한 바람만 나옴"],
      },
    ]);
  });

  it("복지사업 새로고침 실패 원인을 안전한 문구로 반환한다", async () => {
    mocks.refreshWelfarePrograms.mockRejectedValue(
      Object.assign(new Error("PUBLIC_DATA_SERVICE_KEY 환경변수가 설정되지 않았습니다."), {
        code: "MISSING_SERVICE_KEY",
      }),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "WELFARE_SYNC_FAILED",
        message: "공공데이터 API 키 미설정",
      },
    });
  });

  it("대상자 메모와 공공 복지사업을 결합해 검토 가능한 제안을 반환한다", async () => {
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.recommendations).toEqual([
      expect.objectContaining({
        subjectId: "subject-1",
        subjectName: "김○○",
        workerName: "이미경",
        programId: "energy-1",
        status: "NEEDS_INFO",
        missingChecks: ["기초생활수급 또는 차상위 여부"],
      }),
    ]);
    expect(payload.data.connections).toEqual({
      publicData: { ok: true, message: "공공데이터 연결 정상" },
      ai: { ok: true, message: "AI 분석 연결 정상" },
    });
    expect(JSON.stringify(payload)).not.toContain("010-");
  });

  it("외부 연동이 모두 실패해도 연결 상태와 빈 결과를 반환한다", async () => {
    mocks.refreshWelfarePrograms.mockRejectedValue(
      Object.assign(new Error("PUBLIC_DATA_SERVICE_KEY 환경변수가 설정되지 않았습니다."), {
        code: "MISSING_SERVICE_KEY",
      }),
    );
    mocks.extractWelfareSignals.mockRejectedValue(
      Object.assign(new Error("AI 분석 응답 시간이 초과되었습니다."), {
        code: "OPENAI_UNAVAILABLE",
      }),
    );

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.recommendations).toEqual([]);
    expect(payload.data.partial).toBe(true);
    expect(payload.data.connections).toEqual({
      publicData: {
        ok: false,
        message: "공공데이터 API 키 미설정",
        reason: "PUBLIC_DATA_SERVICE_KEY 환경변수가 설정되지 않았습니다.",
      },
      ai: {
        ok: false,
        message: "AI 분석 응답 시간 초과",
        reason: "AI 분석 응답 시간이 초과되었습니다.",
      },
    });
  });

  it("외부 서비스 응답 오류의 상세 원인을 함께 반환한다", async () => {
    mocks.refreshWelfarePrograms.mockRejectedValue(
      Object.assign(new Error("복지서비스 API가 HTTP 503으로 응답했습니다."), {
        code: "UPSTREAM_HTTP_ERROR",
      }),
    );
    mocks.extractWelfareSignals.mockRejectedValue(
      Object.assign(new Error("AI 분석 서비스가 HTTP 502로 응답했습니다."), {
        code: "OPENAI_HTTP_ERROR",
      }),
    );

    const response = await POST();
    const payload = await response.json();

    expect(payload.data.connections).toEqual({
      publicData: {
        ok: false,
        message: "공공데이터 응답 오류",
        reason: "복지서비스 API가 HTTP 503으로 응답했습니다.",
      },
      ai: {
        ok: false,
        message: "AI 분석 응답 오류",
        reason: "AI 분석 서비스가 HTTP 502로 응답했습니다.",
      },
    });
  });

  it("알 수 없는 외부 오류 메시지는 상세 원인에서 숨긴다", async () => {
    mocks.refreshWelfarePrograms.mockRejectedValue(
      Object.assign(new Error("token=server-secret"), {
        code: "UNKNOWN_UPSTREAM_CODE",
      }),
    );

    const response = await POST();
    const payload = await response.json();

    expect(payload.data.connections.publicData.reason).toBe(
      "외부 서비스 처리 중 예상하지 못한 오류가 발생했습니다.",
    );
    expect(JSON.stringify(payload)).not.toContain("server-secret");
  });
});
