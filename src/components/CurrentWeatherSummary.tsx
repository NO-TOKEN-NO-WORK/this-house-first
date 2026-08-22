"use client";

import { useEffect, useRef, useState } from "react";
import type { CurrentWeather } from "@/lib/public-data/kma";
import { toKmaGrid, type KmaGrid } from "@/lib/public-data/kma-grid";

const REFRESH_INTERVAL_MS = 600_000;
const OBSERVED_AT_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

type CurrentWeatherFetcher = (
  input: RequestInfo | URL,
) => Promise<Pick<Response, "json" | "ok">>;

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isCurrentWeather(value: unknown): value is CurrentWeather {
  if (!value || typeof value !== "object") return false;
  const weather = value as Partial<CurrentWeather>;
  return (
    weather.source === "기상청 초단기실황 조회서비스" &&
    isTimestamp(weather.observedAt) &&
    isTimestamp(weather.fetchedAt) &&
    typeof weather.temperature === "number" &&
    typeof weather.humidity === "number" &&
    typeof weather.feelsLikeTemperature === "number" &&
    !!weather.grid &&
    typeof weather.grid.nx === "number" &&
    typeof weather.grid.ny === "number"
  );
}

/** 내부 Route Handler 응답만 받아 클라이언트에 기상청 키가 노출되지 않게 한다. */
export async function requestCurrentWeather(
  grid: KmaGrid | null = null,
  fetcher: CurrentWeatherFetcher = fetch,
): Promise<CurrentWeather> {
  const response = await fetcher(
    grid
      ? `/api/public-data/current-weather?nx=${grid.nx}&ny=${grid.ny}`
      : "/api/public-data/current-weather",
  );
  if (!response.ok) {
    throw new Error("현재 날씨를 불러오지 못했습니다.");
  }

  const payload: unknown = await response.json();
  const weather =
    payload && typeof payload === "object" && "data" in payload
      ? payload.data
      : null;
  if (!isCurrentWeather(weather)) {
    throw new Error("현재 날씨를 불러오지 못했습니다.");
  }
  return weather;
}

export function requestCurrentLocationGrid(
  geolocation: Geolocation,
): Promise<KmaGrid> {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => {
        try {
          resolve(toKmaGrid(coords.latitude, coords.longitude));
        } catch (error) {
          reject(error);
        }
      },
      reject,
      { enableHighAccuracy: true, maximumAge: 300_000, timeout: 10_000 },
    );
  });
}

const ROOT_CLASS = {
  today:
    "flex min-h-28 flex-col justify-center gap-3 rounded-lg border border-border-default bg-surface-soft px-4 py-4 text-text-primary",
  admin:
    "flex min-h-20 flex-col justify-center gap-1 border-l border-border-default px-4 text-text-primary",
} as const;

const VALUE_CLASS = {
  today: "text-heading-20",
  admin: "text-label-16",
} as const;

type LocationStatus = "idle" | "locating" | "active" | "failed";

function LocationControl({
  onRequest,
  status,
}: {
  onRequest: () => void;
  status: LocationStatus;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="min-h-11 rounded-md border border-border-default px-3 text-label-14 text-text-primary disabled:opacity-60"
        disabled={status === "locating"}
        onClick={onRequest}
        type="button"
      >
        {status === "locating" ? "위치 확인 중…" : "현재 위치 날씨"}
      </button>
      {status === "active" ? (
        <p role="status" className="text-body-14 text-text-tertiary">
          현재 위치 기준
        </p>
      ) : null}
      {status === "failed" ? (
        <p role="alert" className="text-body-14 text-status-critical-strong">
          위치를 확인하지 못했습니다
        </p>
      ) : null}
    </div>
  );
}

export function CurrentWeatherSummary({
  variant,
  valuesOnly = false,
}: {
  variant: "today" | "admin";
  valuesOnly?: boolean;
}) {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [failed, setFailed] = useState(false);
  const [grid, setGrid] = useState<KmaGrid | null>(null);
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("idle");
  const locationRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let latestRequest = 0;

    async function refresh() {
      const request = ++latestRequest;
      try {
        const currentWeather = await requestCurrentWeather(grid);
        if (!cancelled && request === latestRequest) {
          setWeather(currentWeather);
          setFailed(false);
        }
      } catch {
        if (!cancelled && request === latestRequest) {
          setFailed(true);
        }
      }
    }

    void refresh();
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [grid]);

  useEffect(
    () => () => {
      locationRequest.current += 1;
    },
    [],
  );

  async function requestLocation() {
    const request = ++locationRequest.current;
    setLocationStatus("locating");
    try {
      if (!navigator.geolocation) throw new Error("Geolocation unavailable");
      const nextGrid = await requestCurrentLocationGrid(navigator.geolocation);
      if (request !== locationRequest.current) return;
      setGrid(nextGrid);
      setLocationStatus("active");
    } catch {
      if (request === locationRequest.current) setLocationStatus("failed");
    }
  }

  const locationControl = (
    <LocationControl onRequest={() => void requestLocation()} status={locationStatus} />
  );

  if (valuesOnly) {
    return (
      <section aria-label="현재 날씨" className={ROOT_CLASS[variant]}>
        {weather ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-body-15 text-text-secondary">
              현재 온도 <strong className={VALUE_CLASS[variant]}>{weather.temperature}°C</strong>
            </p>
            <p className="text-body-15 text-text-secondary">
              체감 온도{" "}
              <strong className={VALUE_CLASS[variant]}>
                {weather.feelsLikeTemperature}°C
              </strong>
            </p>
          </div>
        ) : null}
      </section>
    );
  }

  if (weather) {
    return (
      <section aria-label="현재 날씨" className={ROOT_CLASS[variant]}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-body-15 text-text-secondary">
            현재 기온 <strong className={VALUE_CLASS[variant]}>{weather.temperature}°C</strong>
          </p>
          <p className="text-body-15 text-text-secondary">
            현재 체감{" "}
            <strong className={VALUE_CLASS[variant]}>
              {weather.feelsLikeTemperature}°C
            </strong>
          </p>
        </div>
        <p className="text-body-14 text-text-tertiary">
          <time dateTime={weather.observedAt}>
            관측 {OBSERVED_AT_FORMAT.format(new Date(weather.observedAt))}
          </time>
          {" · "}
          {weather.source}
        </p>
        {failed ? (
          <p role="status" aria-live="polite" className="text-body-14 text-status-critical-strong">
            갱신 실패 · 마지막 관측값을 표시합니다
          </p>
        ) : null}
        {locationControl}
      </section>
    );
  }

  if (failed) {
    return (
      <section aria-label="현재 날씨" className={ROOT_CLASS[variant]}>
        <p role="alert" className="text-body-15 text-text-secondary">
          현재 날씨를 불러오지 못했습니다
        </p>
        {locationControl}
      </section>
    );
  }

  return (
    <section aria-label="현재 날씨" className={ROOT_CLASS[variant]}>
      <p role="status" className="text-body-15 text-text-secondary">
        날씨 확인 중
      </p>
      {locationControl}
    </section>
  );
}
