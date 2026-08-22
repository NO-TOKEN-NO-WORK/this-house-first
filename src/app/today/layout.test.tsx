import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TodayLayout from "./layout";

describe("TodayLayout PWA 설치 사건", () => {
  it("hydration 전에 설치 가능 사건을 임시 보관한다", () => {
    const html = renderToStaticMarkup(
      TodayLayout({
        children: <main>담당자 화면</main>,
        params: Promise.resolve({}),
      }),
    );

    expect(html.indexOf("beforeinstallprompt")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("beforeinstallprompt")).toBeLessThan(
      html.indexOf("담당자 화면"),
    );
  });
});
