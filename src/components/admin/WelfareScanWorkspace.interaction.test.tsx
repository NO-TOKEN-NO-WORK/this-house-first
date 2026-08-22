import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  cursor: 0,
  setters: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useMemo: <T,>(factory: () => T) => factory(),
  useState: <T,>(initial: T) => {
    const setter = vi.fn();
    hooks.setters[hooks.cursor++] = setter;
    return [initial, setter] as const;
  },
}));

import { WelfareScanWorkspace } from "./WelfareScanWorkspace";

/** WelfareScanWorkspace의 useState 호출 순서 */
const PROGRAMS = 0;
const NOTICE = 4;
const PROGRAM_COUNT = 7;

type ButtonElement = ReactElement<{
  children?: ReactNode;
  onClick: () => Promise<void>;
}>;

function findButton(node: ReactNode, label: string): ButtonElement | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    const element = child as ReactElement<{ children?: ReactNode; onClick?: () => Promise<void> }>;
    if (element.type === "button" && element.props.children === label) {
      return element as ButtonElement;
    }
    const button = findButton(element.props.children, label);
    if (button) return button;
  }
  return null;
}

describe("복지사업 정보 새로고침", () => {
  beforeEach(() => {
    hooks.cursor = 0;
    hooks.setters = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET 응답의 복지사업과 개수를 화면 상태에 반영한다", async () => {
    const program = {
      id: "energy-1",
      name: "저소득층 에너지효율개선사업",
      ministry: "기후에너지환경부",
      summary: "냉방기기와 단열 개선을 지원합니다.",
      selectionCriteria: "기초생활수급자 또는 차상위계층",
      target: "저소득 노인가구",
      link: "https://www.bokjiro.go.kr/energy",
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { programs: [program], count: 1 } })),
    );
    vi.stubGlobal("fetch", fetcher);

    const workspace = WelfareScanWorkspace({});
    const button = findButton(workspace.props.children, "복지사업 정보 새로고침");
    await button?.props.onClick();

    expect(button).not.toBeNull();
    expect(fetcher).toHaveBeenCalledWith("/api/welfare-scan");
    expect(hooks.setters[PROGRAMS]).toHaveBeenCalledWith([program]);
    expect(hooks.setters[PROGRAM_COUNT]).toHaveBeenCalledWith(1);
    expect(hooks.setters[NOTICE]).toHaveBeenLastCalledWith(
      "1개 관련 복지사업을 새로 확인했습니다.",
    );
  });
});
