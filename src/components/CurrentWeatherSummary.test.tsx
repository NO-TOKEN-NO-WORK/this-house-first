import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CurrentWeather } from "@/lib/public-data/kma";

const hooks = vi.hoisted(() => ({
  cursor: 0,
  effects: [] as Array<() => void | (() => void)>,
  setters: [] as Array<ReturnType<typeof vi.fn>>,
  values: [] as unknown[],
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => {
    hooks.effects.push(effect);
  },
  useState: <T,>(initial: T) => {
    const index = hooks.cursor++;
    return [
      (index in hooks.values ? hooks.values[index] : initial) as T,
      hooks.setters[index] ?? vi.fn(),
    ];
  },
}));

import {
  CurrentWeatherSummary,
  requestCurrentLocationGrid,
  requestCurrentWeather,
} from "./CurrentWeatherSummary";

const weather: CurrentWeather = {
  source: "기상청 초단기실황 조회서비스",
  grid: { nx: 60, ny: 127 },
  observedAt: "2026-08-22T14:00:00+09:00",
  fetchedAt: "2026-08-22T05:12:00.000Z",
  temperature: 31.2,
  humidity: 68,
  feelsLikeTemperature: 32.3,
};

/** CurrentWeatherSummary의 useState 호출 순서 */
const WEATHER = 0;
const FAILED = 1;
const LOCATION_STATUS = 3;

function render(variant: "today" | "admin" = "today") {
  hooks.cursor = 0;
  return renderToStaticMarkup(CurrentWeatherSummary({ variant }));
}

describe("requestCurrentWeather", () => {
  it("내부 현재 날씨 API의 data 값을 반환한다", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: weather }), { status: 200 }),
    );

    await expect(requestCurrentWeather(null, fetcher)).resolves.toEqual(weather);
    expect(fetcher).toHaveBeenCalledWith("/api/public-data/current-weather");
  });

  it("현재 위치 격자를 현재 날씨 API 쿼리로 전달한다", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: weather }), { status: 200 }),
    );

    await expect(
      requestCurrentWeather({ nx: 89, ny: 90 }, fetcher),
    ).resolves.toEqual(weather);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/public-data/current-weather?nx=89&ny=90",
    );
  });

  it("오류 payload 응답은 실패로 전환할 수 있게 거절한다", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "MISSING_WEATHER_GRID" } }), {
        status: 503,
      }),
    );

    await expect(requestCurrentWeather(null, fetcher)).rejects.toThrow(
      "현재 날씨를 불러오지 못했습니다.",
    );
  });

  it("200 응답이어도 해석할 수 없는 관측시각이면 거절한다", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { ...weather, observedAt: "not-a-timestamp" } }),
        { status: 200 },
      ),
    );

    await expect(requestCurrentWeather(null, fetcher)).rejects.toThrow(
      "현재 날씨를 불러오지 못했습니다.",
    );
  });
});

describe("requestCurrentLocationGrid", () => {
  it("브라우저 현재 위치를 기상청 격자로 변환한다", async () => {
    const geolocation = {
      getCurrentPosition(success: PositionCallback) {
        success({
          coords: { latitude: 37.5665, longitude: 126.978 },
        } as GeolocationPosition);
      },
    } as Geolocation;

    await expect(requestCurrentLocationGrid(geolocation)).resolves.toEqual({
      nx: 60,
      ny: 127,
    });
  });
});

describe("CurrentWeatherSummary", () => {
  function resetHooks() {
    hooks.cursor = 0;
    hooks.effects = [];
    hooks.setters = [];
    hooks.values = [];
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  }

  async function settle() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  it("성공한 현재 기온·체감온도·관측시각과 출처를 표시한다", () => {
    resetHooks();
    hooks.values[WEATHER] = weather;
    hooks.values[FAILED] = false;

    const html = render();

    expect(html).toMatch(/현재 기온.*31\.2°C/);
    expect(html).toMatch(/현재 체감.*32\.3°C/);
    expect(html).toMatch(/관측.*14:00/);
    expect(html).toContain("기상청 초단기실황 조회서비스");
  });

  it("첫 요청 전에는 고정된 날씨 확인 상태를 표시한다", () => {
    resetHooks();

    const html = render("admin");

    expect(html).toContain("날씨 확인 중");
    expect(html).toContain('role="status"');
  });

  it("사용자가 직접 위치 권한을 요청하는 현재 위치 날씨 버튼을 표시한다", () => {
    resetHooks();

    const html = render();

    expect(html).toContain("현재 위치 날씨");
    expect(html).toContain('type="button"');
  });

  it("현재 위치 날씨가 적용됐음을 표시한다", () => {
    resetHooks();
    hooks.values[LOCATION_STATUS] = "active";

    const html = render();

    expect(html).toContain("현재 위치 기준");
    expect(html).toContain('role="status"');
  });

  it("위치 권한이나 GPS 확인 실패를 날씨 조회 실패와 구분해 표시한다", () => {
    resetHooks();
    hooks.values[LOCATION_STATUS] = "failed";

    const html = render();

    expect(html).toContain("위치를 확인하지 못했습니다");
    expect(html).toContain('role="alert"');
  });

  it("현재 날씨 요청이 실패하면 나머지 화면을 막지 않는 오류 문구를 표시한다", () => {
    resetHooks();
    hooks.values[FAILED] = true;

    const html = render();

    expect(html).toContain("현재 날씨를 불러오지 못했습니다");
    expect(html).toContain('role="alert"');
  });

  it("마지막 성공값이 있어도 갱신 실패를 명시한다", () => {
    resetHooks();
    hooks.values[WEATHER] = weather;
    hooks.values[FAILED] = true;

    const html = render();

    expect(html).toMatch(/현재 기온.*31\.2°C/);
    expect(html).toContain("갱신 실패");
  });

  it("200 응답의 잘못된 관측시각은 화면에 넣지 않고 실패로 처리한다", async () => {
    resetHooks();
    const setWeather = vi.fn();
    const setFailed = vi.fn();
    const setInterval = vi.fn().mockReturnValue(123);
    const clearInterval = vi.fn();
    hooks.setters = [setWeather, setFailed];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { ...weather, observedAt: "not-a-timestamp" },
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("setInterval", setInterval);
    vi.stubGlobal("clearInterval", clearInterval);

    CurrentWeatherSummary({ variant: "today" });
    const cleanup = hooks.effects[0]?.();
    await settle();

    expect(setWeather).not.toHaveBeenCalled();
    expect(setFailed).toHaveBeenCalledWith(true);
    cleanup?.();
  });

  it("더 늦게 시작한 갱신이 먼저 끝나면 이전 응답으로 되돌리지 않는다", async () => {
    resetHooks();
    const setWeather = vi.fn();
    const setFailed = vi.fn();
    const setInterval = vi.fn().mockReturnValue(123);
    const clearInterval = vi.fn();
    const resolvers: Array<(response: Response) => void> = [];
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const newerWeather = { ...weather, temperature: 32.1 };
    hooks.setters = [setWeather, setFailed];
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("setInterval", setInterval);
    vi.stubGlobal("clearInterval", clearInterval);

    CurrentWeatherSummary({ variant: "today" });
    const cleanup = hooks.effects[0]?.();
    const refresh = setInterval.mock.calls[0]?.[0] as () => void;
    refresh();

    resolvers[1]!(
      new Response(JSON.stringify({ data: newerWeather }), { status: 200 }),
    );
    await settle();
    resolvers[0]!(new Response(JSON.stringify({ data: weather }), { status: 200 }));
    await settle();

    expect(setWeather).toHaveBeenCalledTimes(1);
    expect(setWeather).toHaveBeenCalledWith(newerWeather);
    expect(setFailed).toHaveBeenCalledWith(false);
    cleanup?.();
  });

  it("마운트 시 조회하고 10분 갱신을 예약하며 해제 뒤 응답은 반영하지 않는다", async () => {
    resetHooks();
    const setWeather = vi.fn();
    const setFailed = vi.fn();
    const setInterval = vi.fn().mockReturnValue(123);
    const clearInterval = vi.fn();
    let resolveResponse: (response: Response) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    hooks.setters = [setWeather, setFailed];
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("setInterval", setInterval);
    vi.stubGlobal("clearInterval", clearInterval);

    CurrentWeatherSummary({ variant: "today" });
    const cleanup = hooks.effects[0]?.();

    expect(fetcher).toHaveBeenCalledWith("/api/public-data/current-weather");
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 600_000);

    cleanup?.();
    resolveResponse!(
      new Response(JSON.stringify({ data: weather }), { status: 200 }),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(clearInterval).toHaveBeenCalledWith(123);
    expect(setWeather).not.toHaveBeenCalled();
    expect(setFailed).not.toHaveBeenCalled();
  });
});
