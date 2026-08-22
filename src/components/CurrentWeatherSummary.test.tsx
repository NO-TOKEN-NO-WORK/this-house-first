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

function render(variant: "today" | "admin" = "today") {
  hooks.cursor = 0;
  return renderToStaticMarkup(CurrentWeatherSummary({ variant }));
}

describe("requestCurrentWeather", () => {
  it("내부 현재 날씨 API의 data 값을 반환한다", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: weather }), { status: 200 }),
    );

    await expect(requestCurrentWeather(fetcher)).resolves.toEqual(weather);
    expect(fetcher).toHaveBeenCalledWith("/api/public-data/current-weather");
  });

  it("오류 payload 응답은 실패로 전환할 수 있게 거절한다", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "MISSING_WEATHER_GRID" } }), {
        status: 503,
      }),
    );

    await expect(requestCurrentWeather(fetcher)).rejects.toThrow(
      "현재 날씨를 불러오지 못했습니다.",
    );
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

  it("현재 날씨 요청이 실패하면 나머지 화면을 막지 않는 오류 문구를 표시한다", () => {
    resetHooks();
    hooks.values[FAILED] = true;

    const html = render();

    expect(html).toContain("현재 날씨를 불러오지 못했습니다");
    expect(html).toContain('role="alert"');
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
