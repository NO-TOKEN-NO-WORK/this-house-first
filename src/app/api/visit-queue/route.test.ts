import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SilentBoard } from "@/lib/board/today";

const { getBoard, withKakaoDrivingRoute } = vi.hoisted(() => ({
  getBoard: vi.fn(),
  withKakaoDrivingRoute: vi.fn(),
}));

vi.mock("@/lib/board/today", () => ({ getBoard }));
vi.mock("@/lib/kakao/driving-route", () => ({ withKakaoDrivingRoute }));

import { GET } from "./route";

const silentBoard: SilentBoard = {
  alerted: false,
  date: "2026-08-22",
  dateLabel: "8월 22일(토)",
  worker: { id: "worker-1", name: "담당자" },
  dong: "비산동",
  subjects: [],
};

describe("GET /api/visit-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("KAKAO_REST_KEY", "rest-key");
  });

  it("비경보일에는 카카오 호출 없이 빈 동선을 반환한다", async () => {
    getBoard.mockResolvedValue(silentBoard);

    const response = await GET(
      new Request("http://localhost/api/visit-queue?date=2026-08-22&workerId=worker-1"),
    );

    expect(response.status).toBe(200);
    expect(getBoard).toHaveBeenCalledWith({ date: "2026-08-22", workerId: "worker-1" });
    expect(withKakaoDrivingRoute).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      data: {
        stops: [],
        totalMinutes: 0,
        totalMeters: 0,
        path: [],
        source: "estimate",
      },
    });
  });

  it("잘못된 날짜는 보드 조회 전에 400으로 거절한다", async () => {
    const response = await GET(
      new Request("http://localhost/api/visit-queue?date=2026-02-30"),
    );

    expect(response.status).toBe(400);
    expect(getBoard).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_PARAMETER" },
    });
  });
});
