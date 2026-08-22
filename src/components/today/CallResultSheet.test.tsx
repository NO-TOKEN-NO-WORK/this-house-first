import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * 컴포넌트를 렌더 밖에서 함수로 부르므로 훅은 목으로 대신한다 (GradeFilter.test.tsx와 같은 방식).
 * `useState`는 호출 순서로 구분한다 — 초깃값만 보면 `pending(false)`과 `result(null)`이 섞인다.
 */
const hooks = vi.hoisted(() => ({
  cursor: 0,
  values: {} as Record<number, unknown>,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useId: () => "call-result",
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    return [index in hooks.values ? hooks.values[index] : initial, vi.fn()];
  },
}));

/** CallResultSheet의 useState 호출 순서 */
const RESULT = 0;
const COOLING = 1;
const PENDING = 3;
const ERROR = 4;
const RECORDING = 5;

import { CallResultSheet } from "./CallResultSheet";
import {
  CallResult,
  CALL_RECORDING_LABELS,
  CALL_RESULT_LABEL,
  CoolingStatus,
  COOLING_STATUS_LABEL,
  RiskGrade,
} from "@/lib/domain";

function contentOf(element: ReactNode): string {
  if (!isValidElement<{ children?: ReactNode }>(element)) {
    throw new Error("Dialog 엘리먼트가 아니다");
  }
  return renderToStaticMarkup(element.props.children);
}

const base = {
  open: true,
  onClose: () => {},
  onSave: () => {},
  name: "김순자",
  age: 88,
  livesAlone: true,
  grade: RiskGrade.CRITICAL,
  phone: "010-2345-1938",
  address: "대구광역시 서구 비산동 1",
};

describe("CallResultSheet", () => {
  beforeEach(() => {
    hooks.cursor = 0;
    hooks.values = {};
  });

  /** 훅 목은 렌더마다 커서를 처음으로 되돌려야 한다 */
  function render(props: Parameters<typeof CallResultSheet>[0]) {
    hooks.cursor = 0;
    return contentOf(CallResultSheet(props) as ReactElement);
  }

  it("결과 버튼 문구는 도메인 상수를 그대로 쓴다", () => {
    const html = render(base);

    for (const value of [
      CallResult.OK,
      CallResult.SYMPTOM,
      CallResult.NO_ANSWER,
      CallResult.EMERGENCY_119,
    ]) {
      expect(html).toContain(CALL_RESULT_LABEL[value]);
    }
    // 연락두절은 Figma 시트에 없다 — 상세 화면에서만 고른다
    expect(html).not.toContain(CALL_RESULT_LABEL[CallResult.UNREACHABLE]);
  });

  it("Figma처럼 화면을 채우는 풀스크린 시트로 연다", () => {
    hooks.cursor = 0;
    const sheet = CallResultSheet(base) as ReactElement<{
      placement?: string;
    }>;

    expect(sheet.props.placement).toBe("fullscreen");
  });

  it("대상자 머리글과 메모 입력을 함께 보여 준다", () => {
    const html = render(base);

    expect(html).toContain("김순자");
    expect(html).toContain("대구광역시 서구 비산동 1");
    expect(html).toContain("통화 어땠나요?");
    expect(html).toContain("냉방기 설비 상태 점검");
    for (const label of Object.values(COOLING_STATUS_LABEL)) {
      expect(html).toContain(label);
    }
    expect(html).toContain("메모 (선택)");
  });

  it("결과를 고르기 전에는 저장할 수 없다 — 빈 기록을 막는다", () => {
    const html = render(base);

    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*저장하기/);
  });

  it("통화 결과만 고르면 냉방기 상태가 비어 있어 아직 저장할 수 없다", () => {
    hooks.values[RESULT] = CallResult.OK;
    const html = render(base);

    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*저장하기/);
    expect(html).toContain('aria-pressed="true"');
  });

  it("통화 결과와 냉방기 상태를 모두 고르면 저장 버튼이 열린다", () => {
    hooks.values[RESULT] = CallResult.NO_ANSWER;
    hooks.values[COOLING] = CoolingStatus.NEEDS_CHECK;
    const html = render(base);

    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>\s*저장하기/);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
  });

  it("저장 중에는 다시 누를 수 없다", () => {
    hooks.values[RESULT] = CallResult.OK;
    hooks.values[COOLING] = CoolingStatus.NORMAL;
    hooks.values[PENDING] = true;
    const html = render(base);

    expect(html).toContain("저장 중…");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*저장 중/);
    // 결과 칸도 잠근다 — 저장 도중에 값이 바뀌면 안 된다
    expect(html).toMatch(/aria-pressed="[^"]*"[^>]*disabled/);
  });

  /*
   * 음성 파일 첨부는 화면만 있고 저장은 없다 (Figma 163:3468 · 164:9043).
   * 아래 검사들은 그 사실을 고정한다 — 저장 계약(`onSave`)에 파일이 끼어들면 여기서 깨진다.
   * 저장된 것으로 오해하지 않도록 화면에도 비저장 안내를 둔다 (ADR-0014 결과 9).
   */
  it("첨부 전에는 무엇을 붙이는 자리인지 안내만 보여 준다", () => {
    const html = render(base);
    const text = html.replace(/<[^>]+>/g, "");

    expect(text).toContain(CALL_RECORDING_LABELS.SECTION);
    expect(text).toContain(CALL_RECORDING_LABELS.EMPTY);
    expect(text).toContain(CALL_RECORDING_LABELS.GUIDE);
    expect(text).toContain(CALL_RECORDING_LABELS.NOT_SAVED);
    expect(html).toContain('accept="audio/*"');
    expect(text).not.toContain(CALL_RECORDING_LABELS.REMOVE);
  });

  it("파일을 고르면 이름과 지우기 버튼으로 바뀐다", () => {
    hooks.values[RECORDING] = "2026-08-23.m4a";
    const html = render(base);

    expect(html).toContain("2026-08-23.m4a");
    expect(html).toContain(`aria-label="${CALL_RECORDING_LABELS.REMOVE}"`);
    // 지우기 버튼의 누르는 자리는 44px다 (ADR-0014 접근성)
    expect(html).toContain("size-11");
  });

  it("첨부는 저장 조건에 끼어들지 않는다 — 결과와 냉방기 상태만 본다", () => {
    hooks.values[RECORDING] = "2026-08-23.m4a";
    expect(render(base)).toMatch(/<button[^>]*disabled[^>]*>\s*저장하기/);

    hooks.values[RESULT] = CallResult.OK;
    hooks.values[COOLING] = CoolingStatus.NORMAL;
    expect(render(base)).not.toMatch(/<button[^>]*disabled[^>]*>\s*저장하기/);
  });

  it("저장이 실패하면 이유를 그대로 보여 주고 시트를 닫지 않는다", () => {
    hooks.values[RESULT] = CallResult.NO_ANSWER;
    hooks.values[COOLING] = CoolingStatus.UNKNOWN;
    hooks.values[ERROR] =
      "재전화는 첫 무응답 기록 30분 후 가능합니다. 12분 뒤 다시 시도하세요.";
    const html = render(base);

    expect(html).toContain('role="alert"');
    expect(html).toContain("12분 뒤 다시 시도하세요.");
    // 실패해도 고른 값은 남는다 — 다시 누르면 되게
    expect(html).toContain('aria-pressed="true"');
  });
});
