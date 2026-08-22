import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HandoverList } from "./SubjectInformationTabs";
import type { BriefingHandoverItem } from "@/lib/briefing/types";
import {
  BRIEFING_CATEGORY_LABEL,
  BriefingCategory,
  CALL_RESULT_LABEL,
  CallResult,
  CHECK_KIND_LABEL,
  CheckKind,
} from "@/lib/domain";

/**
 * 인수인계 목록은 대상자 정보 화면의 `AI 요약` 탭과 대상자 상세의 카드가 함께 쓴다.
 * 두 자리에서 같은 문장·같은 근거가 나와야 하므로 목록 자체를 검사한다.
 */

const items: BriefingHandoverItem[] = [
  {
    category: BriefingCategory.LIFE_RHYTHM,
    categoryLabel: BRIEFING_CATEGORY_LABEL[BriefingCategory.LIFE_RHYTHM],
    text: "새벽 5시에 밭에 다녀오십니다",
    source: {
      checkEventId: "call-1",
      date: "2026-08-19",
      dateLabel: "8/19 (수)",
      kind: CheckKind.CALL,
      kindLabel: CHECK_KIND_LABEL[CheckKind.CALL],
      result: CallResult.OK,
      resultLabel: CALL_RESULT_LABEL[CallResult.OK],
      label: "8/19 (수) 전화 · 괜찮았어요",
    },
  },
];

describe("HandoverList", () => {
  it("줄 이름은 도메인 상수를, 근거는 서버가 만든 문구를 그대로 쓴다", () => {
    const html = renderToStaticMarkup(<HandoverList items={items} />);
    const text = html.replace(/<[^>]+>/g, "");

    expect(text).toContain(BRIEFING_CATEGORY_LABEL[BriefingCategory.LIFE_RHYTHM]);
    expect(text).toContain("새벽 5시에 밭에 다녀오십니다");
    expect(text).toContain("근거 · 8/19 (수) 전화 · 괜찮았어요");
  });

  it("줄이 없으면 아무것도 그리지 않는다 — 빈 브리핑은 정상 상태다", () => {
    expect(renderToStaticMarkup(<HandoverList items={[]} />)).toBe(
      '<ul class="flex flex-col gap-5"></ul>',
    );
  });
});
