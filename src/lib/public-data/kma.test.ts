import { describe, expect, it } from "vitest";
import { AlertLevel } from "../domain";
import type { PublicDataFetch } from "./client";
import { getHeatForecast, resolveForecastBase } from "./kma";

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
