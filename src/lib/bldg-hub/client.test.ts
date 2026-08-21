import { describe, expect, it } from "vitest";
import type { PublicDataFetch } from "../public-data/client";
import { fetchBuildingTitles } from "./client";

describe("fetchBuildingTitles", () => {
  it("번·지를 4자리로 보정하고 건축HUB 페이지를 반환한다", async () => {
    let requestedUrl: URL | undefined;
    const fetcher: PublicDataFetch = async (url) => {
      requestedUrl = url;
      return new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
            body: {
              items: {
                item: {
                  mgmBldrgstPk: "building-1",
                  platPlc: "대구광역시 서구 비산동 12",
                },
              },
              totalCount: 1,
              pageNo: 1,
              numOfRows: 100,
            },
          },
        }),
      );
    };

    const page = await fetchBuildingTitles(
      {
        sigunguCd: "27170",
        bjdongCd: "10500",
        bun: "12",
        ji: "0",
      },
      { serviceKey: "test", fetcher },
    );

    expect(requestedUrl?.searchParams.get("bun")).toBe("0012");
    expect(requestedUrl?.searchParams.get("ji")).toBe("0000");
    expect(page.totalCount).toBe(1);
    expect(page.items[0].mgmBldrgstPk).toBe("building-1");
  });
});
