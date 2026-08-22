import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// 컴포넌트를 렌더 밖에서 함수로 부르므로 훅은 목으로 대신한다 (GradeFilter.test.tsx와 같은 방식)
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useId: () => "call-guide-name",
}));

import { CallGuideDialog } from "./CallGuideDialog";
import { CALL_GUIDE_QUESTIONS, GRADE_LABEL, RiskGrade } from "@/lib/domain";

/**
 * 껍데기(Dialog)는 포털·document가 있어야 하므로 서버에서 렌더되지 않는다.
 * 그래서 `CallGuideDialog`가 만든 Dialog 엘리먼트의 children만 떼어 내용만 검사한다.
 */
function contentOf(element: ReactNode): string {
  if (!isValidElement<{ children?: ReactNode }>(element)) {
    throw new Error("Dialog 엘리먼트가 아니다");
  }
  return renderToStaticMarkup(element.props.children);
}

const base = {
  open: true,
  onClose: () => {},
  name: "김순자",
  age: 88,
  livesAlone: true,
  grade: RiskGrade.CRITICAL,
  phone: "010-2345-1938",
  address: "행복동 중앙로 12-3",
};

describe("CallGuideDialog", () => {
  it.each([RiskGrade.CRITICAL, RiskGrade.HIGH, RiskGrade.MODERATE])(
    "위험 단계 칩은 문구를 박지 않고 %s의 도메인 상수를 그대로 쓴다",
    (grade) => {
      const html = contentOf(CallGuideDialog({ ...base, grade }) as ReactElement);

      // 칩 안에 든 글자가 GRADE_LABEL과 같아야 한다 (ADR-0014, 도메인 규칙 2)
      const chip = /class="[^"]*text-label-15[^"]*"[^>]*>([^<]+)</.exec(html);
      expect(chip?.[1]).toBe(GRADE_LABEL[grade]);
    },
  );

  it("대상자·연락처와 안내 질문을 모두 보여 준다", () => {
    const html = contentOf(CallGuideDialog(base) as ReactElement);

    expect(html).toContain("김순자");
    expect(html).toContain("88세 · 독거");
    expect(html).toContain("010-2345-1938");
    expect(html).toContain("행복동 중앙로 12-3");
    for (const question of CALL_GUIDE_QUESTIONS) {
      expect(html).toContain(question);
    }
  });

  it("번호가 있으면 tel: 링크로 건다", () => {
    const html = contentOf(CallGuideDialog(base) as ReactElement);

    expect(html).toContain('href="tel:010-2345-1938"');
  });

  it("번호가 없으면 걸 수 없다는 것을 그대로 보여 준다", () => {
    const html = contentOf(
      CallGuideDialog({ ...base, phone: null }) as ReactElement,
    );

    expect(html).not.toContain("tel:");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("번호 없음");
  });

  it("질문 목록은 넣는 쪽이 갈아 끼울 수 있다", () => {
    const html = contentOf(
      CallGuideDialog({ ...base, questions: ["보일러 켜셨어요?"] }) as ReactElement,
    );

    expect(html).toContain("보일러 켜셨어요?");
    expect(html).not.toContain(CALL_GUIDE_QUESTIONS[0]!);
  });

  it("독거가 아니면 독거 표기를 붙이지 않는다", () => {
    const html = contentOf(
      CallGuideDialog({ ...base, livesAlone: false }) as ReactElement,
    );

    expect(html).toContain("88세");
    expect(html).not.toContain("독거");
  });
});
