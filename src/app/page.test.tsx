import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("관리자 관제 대시보드로 이동할 수 있다", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain('href="/admin"');
    expect(html).not.toContain("준비 중");
  });
});
