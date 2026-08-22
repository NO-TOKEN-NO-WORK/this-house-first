import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * 컴포넌트를 렌더 밖에서 함수로 부르므로 훅은 목으로 대신한다 (CallResultSheet.test.tsx와 같은 방식).
 * `useState`는 호출 순서로 구분한다 — 초깃값만 보면 빈 배열과 null이 섞인다.
 */
const hooks = vi.hoisted(() => ({
  cursor: 0,
  values: {} as Record<number, unknown>,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    return [index in hooks.values ? hooks.values[index] : initial, vi.fn()];
  },
}));

/** VisitAttachments의 useState 호출 순서 */
const PHOTOS = 0;
const RECORDING = 1;

import { VisitAttachments } from "./VisitAttachments";
import { VISIT_ATTACHMENT_LABELS, VISIT_PHOTO_MAX } from "@/lib/domain";

function photos(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `photo-${index}`,
    name: `현관-${index}.jpg`,
    url: `blob:photo-${index}`,
  }));
}

function render() {
  return renderToStaticMarkup(<VisitAttachments />);
}

describe("VisitAttachments", () => {
  beforeEach(() => {
    hooks.cursor = 0;
    hooks.values = {};
  });

  it("빈 상태는 Figma 문구 그대로 사진·음성 자리만 보여 준다", () => {
    const html = render();

    expect(html).toContain(VISIT_ATTACHMENT_LABELS.SECTION);
    expect(html).toContain(VISIT_ATTACHMENT_LABELS.PHOTO_EMPTY);
    expect(html).toContain(VISIT_ATTACHMENT_LABELS.AUDIO_EMPTY);
    // 붙인 것이 없으면 지우기 버튼도 없다 — 눌러도 아무 일 없는 버튼을 남기지 않는다
    expect(html).not.toContain(VISIT_ATTACHMENT_LABELS.AUDIO_REMOVE);
    expect(html).not.toContain(VISIT_ATTACHMENT_LABELS.PHOTO_REMOVE);
  });

  /*
    저장은 없지만 그 사실을 화면에 적지도 않는다 — 디자인에 없는 문구다 (ADR-0014 결과 9).
    저장 계약을 지키는 것은 `/api/checks` 본문이고, 이 검사는 문구가 다시 들어오는 것을 막는다.
  */
  it("디자인에 없는 안내 문구를 덧붙이지 않는다", () => {
    expect(render()).not.toContain("저장되지 않습니다");
  });

  it("붙인 사진은 미리보기와 장별 지우기 버튼을 갖는다", () => {
    hooks.values[PHOTOS] = photos(2);
    const html = render();

    expect(html).toContain('src="blob:photo-0"');
    expect(html).toContain('src="blob:photo-1"');
    expect(
      html.match(new RegExp(VISIT_ATTACHMENT_LABELS.PHOTO_REMOVE, "g"))?.length,
    ).toBe(2);
    // 아직 다섯 장이 아니라 더 고를 자리가 남아 있다
    expect(html).toContain(VISIT_ATTACHMENT_LABELS.PHOTO_EMPTY);
  });

  it("다섯 장을 채우면 더 고를 자리를 내밀지 않는다", () => {
    hooks.values[PHOTOS] = photos(VISIT_PHOTO_MAX);
    const html = render();

    expect(
      html.match(new RegExp(VISIT_ATTACHMENT_LABELS.PHOTO_REMOVE, "g"))?.length,
    ).toBe(VISIT_PHOTO_MAX);
    expect(html).not.toContain(VISIT_ATTACHMENT_LABELS.PHOTO_EMPTY);
  });

  it("음성 파일을 붙이면 자리 표시 대신 파일 이름과 지우기가 보인다", () => {
    hooks.values[RECORDING] = "2026-08-23.m4a";
    const html = render();

    expect(html).toContain("2026-08-23.m4a");
    expect(html).not.toContain(VISIT_ATTACHMENT_LABELS.AUDIO_EMPTY);
    expect(html).toContain(`aria-label="${VISIT_ATTACHMENT_LABELS.AUDIO_REMOVE}"`);
  });
});
