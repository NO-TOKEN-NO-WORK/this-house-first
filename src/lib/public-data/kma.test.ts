import { describe, expect, it } from "vitest";
import { AlertLevel } from "../domain";
import type { NextRequestInit, PublicDataFetch } from "./client";
import {
  getCurrentWeather,
  getHeatForecast,
  resolveForecastBase,
  resolveObservationBase,
} from "./kma";

describe("resolveObservationBase", () => {
  it.each([
    [
      "14:09에는 이전 정시를 쓴다",
      new Date("2026-08-22T05:09:00.000Z"),
      { baseDate: "20260822", baseTime: "1300" },
    ],
    [
      "14:10에는 현재 정시를 쓴다",
      new Date("2026-08-22T05:10:00.000Z"),
      { baseDate: "20260822", baseTime: "1400" },
    ],
    [
      "00:05에는 전날 23시를 쓴다",
      new Date("2026-08-21T15:05:00.000Z"),
      { baseDate: "20260821", baseTime: "2300" },
    ],
  ])("%s", (_label, now, expected) => {
    expect(resolveObservationBase(now)).toEqual(expected);
  });
});

describe("getCurrentWeather", () => {
  it("T1H·REH 초단기실황을 현재 날씨로 변환하고 600초 캐시를 사용한다", async () => {
    let requestedUrl: URL | undefined;
    let requestedInit: NextRequestInit | undefined;
    const fetcher: PublicDataFetch = async (url, init) => {
      requestedUrl = url;
      requestedInit = init;
      return new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
            body: {
              items: {
                item: [
                  {
                    baseDate: "20260822",
                    baseTime: "1400",
                    category: "T1H",
                    obsrValue: "31.2",
                    nx: 60,
                    ny: 127,
                  },
                  {
                    baseDate: "20260822",
                    baseTime: "1400",
                    category: "REH",
                    obsrValue: "68",
                    nx: 60,
                    ny: 127,
                  },
                ],
              },
            },
          },
        }),
      );
    };

    const result = await getCurrentWeather(
      { nx: 60, ny: 127 },
      {
        serviceKey: "decoded/key+value=",
        fetcher,
        now: new Date("2026-08-22T05:12:00.000Z"),
      },
    );

    expect(requestedUrl?.searchParams.get("ServiceKey")).toBe(
      "decoded/key+value=",
    );
    expect(requestedUrl?.searchParams.get("base_date")).toBe("20260822");
    expect(requestedUrl?.searchParams.get("base_time")).toBe("1400");
    expect(requestedInit).toMatchObject({ next: { revalidate: 600 } });
    expect(requestedInit).not.toHaveProperty("cache");
    expect(result).toEqual({
      source: "기상청 초단기실황 조회서비스",
      grid: { nx: 60, ny: 127 },
      observedAt: "2026-08-22T14:00:00+09:00",
      fetchedAt: "2026-08-22T05:12:00.000Z",
      temperature: 31.2,
      humidity: 68,
      feelsLikeTemperature: 32.3,
    });
  });

  it("T1H 또는 REH가 없으면 상위 응답 오류를 반환한다", async () => {
    const fetcher: PublicDataFetch = async () =>
      new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
            body: {
              items: {
                item: {
                  baseDate: "20260822",
                  baseTime: "1400",
                  category: "T1H",
                  obsrValue: "31.2",
                  nx: 60,
                  ny: 127,
                },
              },
            },
          },
        }),
      );

    await expect(
      getCurrentWeather(
        { nx: 60, ny: 127 },
        {
          serviceKey: "decoded/key+value=",
          fetcher,
          now: new Date("2026-08-22T05:12:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_UPSTREAM_RESPONSE",
      status: 502,
    });
  });

  it.each([
    ["빈 문자열", " "],
    ["null", null],
  ])("%s 관측값을 숫자 0으로 해석하지 않는다", async (_label, obsrValue) => {
    const fetcher: PublicDataFetch = async () =>
      new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
            body: {
              items: {
                item: [
                  {
                    baseDate: "20260822",
                    baseTime: "1400",
                    category: "T1H",
                    obsrValue,
                    nx: 60,
                    ny: 127,
                  },
                  {
                    baseDate: "20260822",
                    baseTime: "1400",
                    category: "REH",
                    obsrValue: "68",
                    nx: 60,
                    ny: 127,
                  },
                ],
              },
            },
          },
        }),
      );

    await expect(
      getCurrentWeather(
        { nx: 60, ny: 127 },
        {
          serviceKey: "decoded/key+value=",
          fetcher,
          now: new Date("2026-08-22T05:12:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_UPSTREAM_RESPONSE",
      status: 502,
    });
  });
});

describe("resolveForecastBase", () => {
  it("17시 정각에는 아직 게시되지 않은 17시 발표 대신 14시 발표를 쓴다", () => {
    expect(resolveForecastBase(new Date("2026-08-22T08:00:00Z"))).toEqual({
      baseDate: "20260822",
      baseTime: "1400",
    });
  });

  it("발표 10분 뒤에는 새 발표시각을 쓴다", () => {
    expect(resolveForecastBase(new Date("2026-08-22T08:10:00Z"))).toEqual({
      baseDate: "20260822",
      baseTime: "1700",
    });
  });
});

describe("getHeatForecast", () => {
  it("TMP·REH 예보를 시간별 체감온도와 운영 단계로 변환한다", async () => {
    let requestedUrl: URL | undefined;
    const fetcher: PublicDataFetch = async (url) => {
      requestedUrl = url;
      return new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
            body: {
              items: {
                item: [
                  { category: "TMP", fcstDate: "20260823", fcstTime: "1200", fcstValue: "33" },
                  { category: "REH", fcstDate: "20260823", fcstTime: "1200", fcstValue: "70" },
                  { category: "TMP", fcstDate: "20260823", fcstTime: "1500", fcstValue: "35" },
                  { category: "REH", fcstDate: "20260823", fcstTime: "1500", fcstValue: "70" },
                  { category: "TMX", fcstDate: "20260823", fcstTime: "1500", fcstValue: "34" },
                ],
              },
            },
          },
        }),
      );
    };

    const result = await getHeatForecast(
      {
        nx: 60,
        ny: 127,
        targetDate: "20260823",
        baseDate: "20260822",
        baseTime: "1700",
      },
      { serviceKey: "decoded/key+value=", fetcher },
    );

    expect(requestedUrl?.searchParams.get("ServiceKey")).toBe(
      "decoded/key+value=",
    );
    expect(result.maxTemperature).toBe(35);
    expect(result.maxFeelsLikeTemperature).toBe(36.4);
    expect(result.level).toBe(AlertLevel.WARNING);
    expect(result.hourly).toHaveLength(2);
  });
});
