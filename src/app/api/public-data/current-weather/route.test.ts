import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentWeather: vi.fn(),
}));

vi.mock("@/lib/public-data/kma", () => ({
  getCurrentWeather: mocks.getCurrentWeather,
}));

import { GET } from "./route";

const weather = {
  source: "기상청 초단기실황 조회서비스",
  grid: { nx: 60, ny: 127 },
  observedAt: "2026-08-22T14:00:00+09:00",
  fetchedAt: "2026-08-22T05:12:00.000Z",
  temperature: 31.2,
  humidity: 68,
  feelsLikeTemperature: 32.3,
};

describe("GET /api/public-data/current-weather", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("기상 격자 환경변수가 누락되면 503 MISSING_WEATHER_GRID을 반환한다", async () => {
    vi.stubEnv("KMA_GRID_NY", "127");

    const response = await GET(
      new Request("http://localhost/api/public-data/current-weather"),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MISSING_WEATHER_GRID" },
    });
    expect(mocks.getCurrentWeather).not.toHaveBeenCalled();
  });

  it.each([
    ["KMA_GRID_NX", "1000", "127"],
    ["KMA_GRID_NY", "60", "-1"],
  ])("%s가 1~3자리 정수가 아니면 503을 반환한다", async (name, nx, ny) => {
    vi.stubEnv("KMA_GRID_NX", nx);
    vi.stubEnv("KMA_GRID_NY", ny);

    const response = await GET(
      new Request("http://localhost/api/public-data/current-weather"),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MISSING_WEATHER_GRID" },
    });
    expect(mocks.getCurrentWeather).not.toHaveBeenCalled();
  });

  it("정상 좌표를 숫자로 전달하고 현재 날씨를 data로 반환한다", async () => {
    vi.stubEnv("KMA_GRID_NX", "60");
    vi.stubEnv("KMA_GRID_NY", "127");
    mocks.getCurrentWeather.mockResolvedValue(weather);

    const response = await GET(
      new Request("http://localhost/api/public-data/current-weather"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: weather });
    expect(mocks.getCurrentWeather).toHaveBeenCalledWith({ nx: 60, ny: 127 });
  });
});
