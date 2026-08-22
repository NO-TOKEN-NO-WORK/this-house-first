import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SubjectDetailLoading from "./loading";

describe("SubjectDetailLoading", () => {
  it("실제 상세 화면과 같은 흰 배경에서 구조형 스켈레톤을 보여 준다", () => {
    const html = renderToStaticMarkup(<SubjectDetailLoading />);

    expect(html).toContain("bg-surface-default");
    expect(html).toContain("animate-pulse");
    expect(html).toContain("motion-reduce:animate-none");
    expect(html).toContain("aria-busy=\"true\"");
    expect(html).toContain("대상자 정보를 불러오는 중입니다.");
    expect(html).not.toContain(
      "flex-1 flex-col bg-background-subtle",
    );
  });
});
