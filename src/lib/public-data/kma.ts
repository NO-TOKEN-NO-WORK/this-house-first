import { AlertLevel } from "../domain";
import {
  calculateSummerFeelsLikeTemperature,
  classifyHeatAlert,
} from "../trigger/heat";
import {
  fetchPublicDataJson,
  PublicDataError,
  type PublicDataFetch,
  requirePublicDataServiceKey,
} from "./client";

const KMA_FORECAST_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";
const KMA_ULTRA_SRT_NCST_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";
const KMA_WARNING_URL =
  "https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList";
const KMA_BASE_TIMES = [
  "0200",
  "0500",
  "0800",
  "1100",
  "1400",
  "1700",
  "2000",
  "2300",
] as const;
const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;

interface KmaHeader {
  resultCode: string;
  resultMsg: string;
}

interface KmaEnvelope<T> {
  response?: {
    header?: KmaHeader;
    body?: {
      items?: { item?: T | T[] } | string;
      totalCount?: number;
    };
  };
}

interface KmaForecastItem {
  baseDate: string;
  baseTime: string;
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
  nx: number;
  ny: number;
}

interface KmaObservationItem {
  baseDate: string;
  baseTime: string;
  category: string;
  obsrValue: string;
  nx: number;
  ny: number;
}

interface KmaWarningItem {
  title: string;
  stnId?: string | number;
  tmSeq?: string | number;
  tmFc: string | number;
}

export interface ForecastBase {
  baseDate: string;
  baseTime: string;
}

export interface ObservationBase {
  baseDate: string;
  baseTime: string;
}

export interface CurrentWeather {
  source: "기상청 초단기실황 조회서비스";
  grid: { nx: number; ny: number };
  observedAt: string;
  fetchedAt: string;
  temperature: number;
  humidity: number;
  feelsLikeTemperature: number;
}

export interface HourlyHeatForecast {
  date: string;
  time: string;
  temperature: number;
  humidity: number;
  feelsLikeTemperature: number;
}

export interface HeatForecast {
  source: "기상청 단기예보 조회서비스";
  grid: { nx: number; ny: number };
  baseDate: string;
  baseTime: string;
  targetDate: string;
  maxTemperature: number;
  maxFeelsLikeTemperature: number;
  level: AlertLevel | null;
  hourly: HourlyHeatForecast[];
}

export interface WeatherWarning {
  title: string;
  stationId: string | null;
  sequence: string | null;
  issuedAt: string;
}

interface RequestOptions {
  serviceKey?: string;
  fetcher?: PublicDataFetch;
  now?: Date;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatShiftedDate(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

export function formatKstDate(date: Date, addDays = 0): string {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  shifted.setUTCDate(shifted.getUTCDate() + addDays);
  return formatShiftedDate(shifted);
}

/** 단기예보 발표 후 안정적으로 조회 가능한 10분 지연을 반영한다. */
export function resolveForecastBase(now: Date = new Date()): ForecastBase {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const availableMinutes = kst.getUTCHours() * 60 + kst.getUTCMinutes() - 10;
  const available = [...KMA_BASE_TIMES]
    .reverse()
    .find((time) => Number(time.slice(0, 2)) * 60 <= availableMinutes);

  if (available) {
    return { baseDate: formatShiftedDate(kst), baseTime: available };
  }

  kst.setUTCDate(kst.getUTCDate() - 1);
  return { baseDate: formatShiftedDate(kst), baseTime: "2300" };
}

/** 초단기실황 발표 후 안정적으로 조회 가능한 10분 지연을 반영한다. */
export function resolveObservationBase(
  now: Date = new Date(),
): ObservationBase {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  if (kst.getUTCMinutes() < 10) kst.setUTCHours(kst.getUTCHours() - 1);

  return {
    baseDate: formatShiftedDate(kst),
    baseTime: `${pad(kst.getUTCHours())}00`,
  };
}

function readKmaItems<T>(payload: KmaEnvelope<T>): T[] {
  const response = payload.response;
  if (!response?.header) {
    throw new PublicDataError(
      "기상청 API 응답에 헤더가 없습니다.",
      "INVALID_UPSTREAM_RESPONSE",
    );
  }
  if (response.header.resultCode !== "00") {
    throw new PublicDataError(
      response.header.resultMsg || "기상청 API 호출에 실패했습니다.",
      "UPSTREAM_API_ERROR",
    );
  }

  const items = response.body?.items;
  if (!items || typeof items === "string" || items.item == null) return [];
  return Array.isArray(items.item) ? items.item : [items.item];
}

function finiteNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getHeatForecast(
  params: {
    nx: number;
    ny: number;
    targetDate?: string;
    baseDate?: string;
    baseTime?: string;
  },
  options: RequestOptions = {},
): Promise<HeatForecast> {
  const now = options.now ?? new Date();
  const resolvedBase = resolveForecastBase(now);
  const baseDate = params.baseDate ?? resolvedBase.baseDate;
  const baseTime = params.baseTime ?? resolvedBase.baseTime;
  const targetDate = params.targetDate ?? formatKstDate(now, 1);
  const serviceKey = options.serviceKey ?? requirePublicDataServiceKey();

  const url = new URL(KMA_FORECAST_URL);
  url.searchParams.set("ServiceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "2000");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("base_date", baseDate);
  url.searchParams.set("base_time", baseTime);
  url.searchParams.set("nx", String(params.nx));
  url.searchParams.set("ny", String(params.ny));

  const payload = await fetchPublicDataJson<KmaEnvelope<KmaForecastItem>>(
    url,
    options.fetcher,
  );
  const items = readKmaItems(payload).filter(
    (item) => item.fcstDate === targetDate,
  );

  const timeSlots = new Map<
    string,
    { temperature?: number; humidity?: number }
  >();
  const dailyMaximums: number[] = [];

  for (const item of items) {
    const value = finiteNumber(item.fcstValue);
    if (value == null) continue;
    if (item.category === "TMX") dailyMaximums.push(value);
    if (item.category !== "TMP" && item.category !== "REH") continue;

    const key = `${item.fcstDate}-${item.fcstTime}`;
    const slot = timeSlots.get(key) ?? {};
    if (item.category === "TMP") slot.temperature = value;
    if (item.category === "REH") slot.humidity = value;
    timeSlots.set(key, slot);
  }

  const hourly = [...timeSlots.entries()]
    .filter(
      (entry): entry is [
        string,
        { temperature: number; humidity: number },
      ] =>
        entry[1].temperature != null && entry[1].humidity != null,
    )
    .map(([key, value]) => ({
      date: key.slice(0, 8),
      time: key.slice(9),
      temperature: value.temperature,
      humidity: value.humidity,
      feelsLikeTemperature: calculateSummerFeelsLikeTemperature(
        value.temperature,
        value.humidity,
      ),
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  if (hourly.length === 0) {
    throw new PublicDataError(
      `${targetDate}의 기온·습도 단기예보가 없습니다. 발표시각과 격자좌표를 확인해 주세요.`,
      "EMPTY_FORECAST",
      404,
    );
  }

  const hourlyMaximum = Math.max(...hourly.map((item) => item.temperature));
  const maxTemperature = Math.max(hourlyMaximum, ...dailyMaximums);
  const maxFeelsLikeTemperature = Math.max(
    ...hourly.map((item) => item.feelsLikeTemperature),
  );

  return {
    source: "기상청 단기예보 조회서비스",
    grid: { nx: params.nx, ny: params.ny },
    baseDate,
    baseTime,
    targetDate,
    maxTemperature,
    maxFeelsLikeTemperature,
    level: classifyHeatAlert(maxFeelsLikeTemperature, maxTemperature),
    hourly,
  };
}

export async function getCurrentWeather(
  params: {
    nx: number;
    ny: number;
    baseDate?: string;
    baseTime?: string;
  },
  options: RequestOptions = {},
): Promise<CurrentWeather> {
  const now = options.now ?? new Date();
  const resolvedBase = resolveObservationBase(now);
  const baseDate = params.baseDate ?? resolvedBase.baseDate;
  const baseTime = params.baseTime ?? resolvedBase.baseTime;
  const serviceKey = options.serviceKey ?? requirePublicDataServiceKey();

  const url = new URL(KMA_ULTRA_SRT_NCST_URL);
  url.searchParams.set("ServiceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "1000");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("base_date", baseDate);
  url.searchParams.set("base_time", baseTime);
  url.searchParams.set("nx", String(params.nx));
  url.searchParams.set("ny", String(params.ny));

  const payload = await fetchPublicDataJson<KmaEnvelope<KmaObservationItem>>(
    url,
    options.fetcher,
    { revalidateSeconds: 600 },
  );
  const values = new Map<string, number>();
  for (const item of readKmaItems(payload)) {
    if (item.category !== "T1H" && item.category !== "REH") continue;
    const value = finiteNumber(item.obsrValue);
    if (value != null) values.set(item.category, value);
  }

  const temperature = values.get("T1H");
  const humidity = values.get("REH");
  if (temperature == null || humidity == null) {
    throw new PublicDataError(
      "기상청 초단기실황에 현재 기온·습도가 없습니다.",
      "INVALID_UPSTREAM_RESPONSE",
    );
  }

  const observedAt = `${baseDate.slice(0, 4)}-${baseDate.slice(
    4,
    6,
  )}-${baseDate.slice(6, 8)}T${baseTime.slice(0, 2)}:${baseTime.slice(
    2,
  )}:00+09:00`;

  return {
    source: "기상청 초단기실황 조회서비스",
    grid: { nx: params.nx, ny: params.ny },
    observedAt,
    fetchedAt: now.toISOString(),
    temperature,
    humidity,
    feelsLikeTemperature: calculateSummerFeelsLikeTemperature(
      temperature,
      humidity,
    ),
  };
}

export async function getWeatherWarnings(
  params: { fromDate: string; toDate: string; stationId?: string },
  options: RequestOptions = {},
): Promise<WeatherWarning[]> {
  const serviceKey = options.serviceKey ?? requirePublicDataServiceKey();
  const url = new URL(KMA_WARNING_URL);
  url.searchParams.set("ServiceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("fromTmFc", params.fromDate);
  url.searchParams.set("toTmFc", params.toDate);
  if (params.stationId) url.searchParams.set("stnId", params.stationId);

  const payload = await fetchPublicDataJson<KmaEnvelope<KmaWarningItem>>(
    url,
    options.fetcher,
  );
  return readKmaItems(payload).map((item) => ({
    title: item.title,
    stationId: item.stnId == null ? null : String(item.stnId),
    sequence: item.tmSeq == null ? null : String(item.tmSeq),
    issuedAt: String(item.tmFc),
  }));
}
