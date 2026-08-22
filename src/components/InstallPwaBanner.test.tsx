import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useEffect: vi.fn(),
  useState: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: hooks.useEffect,
  useState: hooks.useState,
}));

type ElementProps = {
  children?: ReactNode;
  onClick?: () => Promise<void>;
};

function findElement(
  node: ReactNode,
  type: string,
): ReactElement<ElementProps> | null {
  if (!isValidElement<ElementProps>(node)) return null;
  if (node.type === type) return node;
  const children = Array.isArray(node.props.children)
    ? node.props.children
    : [node.props.children];
  for (const child of children) {
    const found = findElement(child, type);
    if (found) return found;
  }
  return null;
}

async function loadBanner() {
  const bannerModule = await import("./InstallPwaBanner").catch(() => null);
  expect(bannerModule).not.toBeNull();
  return bannerModule;
}

describe("InstallPwaBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("Chromium 설치 가능 사건을 잡아 자체 설치 배너를 연다", async () => {
    let effect: (() => void | (() => void)) | undefined;
    const listeners = new Map<string, EventListener>();
    const setMode = vi.fn();
    const setPrompt = vi.fn();
    hooks.useState
      .mockReturnValueOnce(["hidden", setMode])
      .mockReturnValueOnce([null, setPrompt]);
    hooks.useEffect.mockImplementation((callback) => {
      effect = callback;
    });
    vi.stubGlobal("navigator", {
      maxTouchPoints: 0,
      platform: "Linux armv8l",
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
    });
    vi.stubGlobal("window", {
      addEventListener: (type: string, listener: EventListener) =>
        listeners.set(type, listener),
      matchMedia: () => ({ matches: false }),
      removeEventListener: vi.fn(),
    });

    const bannerModule = await loadBanner();
    if (!bannerModule) return;
    bannerModule.InstallPwaBanner();
    effect?.();

    const event = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
    } as unknown as Event;
    listeners.get("beforeinstallprompt")?.(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(setPrompt).toHaveBeenCalledWith(event);
    expect(setMode).toHaveBeenCalledWith("native");
  });

  it("hydration 전에 임시 보관한 설치 사건도 배너로 복구한다", async () => {
    let effect: (() => void | (() => void)) | undefined;
    const setMode = vi.fn();
    const setPrompt = vi.fn();
    const promptEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
    } as unknown as Event;
    hooks.useState
      .mockReturnValueOnce(["hidden", setMode])
      .mockReturnValueOnce([null, setPrompt]);
    hooks.useEffect.mockImplementation((callback) => {
      effect = callback;
    });
    vi.stubGlobal("navigator", {
      maxTouchPoints: 0,
      platform: "Linux armv8l",
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
    });
    vi.stubGlobal("window", {
      __thfInstallPrompt: promptEvent,
      addEventListener: vi.fn(),
      matchMedia: () => ({ matches: false }),
      removeEventListener: vi.fn(),
    });

    const bannerModule = await loadBanner();
    if (!bannerModule) return;
    bannerModule.InstallPwaBanner();
    effect?.();
    await Promise.resolve();

    expect(setPrompt).toHaveBeenCalledWith(promptEvent);
    expect(setMode).toHaveBeenCalledWith("native");
  });

  it("개발 Strict Mode가 effect를 재실행해도 임시 설치 사건을 잃지 않는다", async () => {
    let effect: (() => void | (() => void)) | undefined;
    const setMode = vi.fn();
    const setPrompt = vi.fn();
    const promptEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
    } as unknown as Event;
    hooks.useState
      .mockReturnValueOnce(["hidden", setMode])
      .mockReturnValueOnce([null, setPrompt]);
    hooks.useEffect.mockImplementation((callback) => {
      effect = callback;
    });
    vi.stubGlobal("navigator", {
      maxTouchPoints: 0,
      platform: "Linux armv8l",
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
    });
    vi.stubGlobal("window", {
      __thfInstallPrompt: promptEvent,
      addEventListener: vi.fn(),
      matchMedia: () => ({ matches: false }),
      removeEventListener: vi.fn(),
    });

    const bannerModule = await loadBanner();
    if (!bannerModule) return;
    bannerModule.InstallPwaBanner();
    const firstCleanup = effect?.();
    if (typeof firstCleanup === "function") firstCleanup();
    effect?.();
    await Promise.resolve();

    expect(setPrompt).toHaveBeenCalledOnce();
    expect(setPrompt).toHaveBeenCalledWith(promptEvent);
    expect(setMode).toHaveBeenCalledWith("native");
  });

  it("설치 버튼은 저장한 브라우저 설치 창을 한 번 열고 배너를 닫는다", async () => {
    const setMode = vi.fn();
    const setPrompt = vi.fn();
    const prompt = { prompt: vi.fn().mockResolvedValue({ outcome: "accepted" }) };
    hooks.useState
      .mockReturnValueOnce(["native", setMode])
      .mockReturnValueOnce([prompt, setPrompt]);

    const bannerModule = await loadBanner();
    if (!bannerModule) return;
    const { InstallPwaBanner } = bannerModule;
    const button = findElement(InstallPwaBanner(), "button");
    await button?.props.onClick?.();

    expect(prompt.prompt).toHaveBeenCalledOnce();
    expect(setPrompt).toHaveBeenCalledWith(null);
    expect(setMode).toHaveBeenCalledWith("hidden");
  });

  it("브라우저 설치 창이 실패해도 오류를 퍼뜨리지 않고 배너를 닫는다", async () => {
    const setMode = vi.fn();
    const setPrompt = vi.fn();
    const prompt = { prompt: vi.fn().mockRejectedValue(new Error("blocked")) };
    hooks.useState
      .mockReturnValueOnce(["native", setMode])
      .mockReturnValueOnce([prompt, setPrompt]);

    const bannerModule = await loadBanner();
    if (!bannerModule) return;
    const button = findElement(bannerModule.InstallPwaBanner(), "button");

    await expect(button?.props.onClick?.()).resolves.toBeUndefined();
    expect(setPrompt).toHaveBeenCalledWith(null);
    expect(setMode).toHaveBeenCalledWith("hidden");
  });

  it("담당자용 배너 본문은 15px 이상으로 표시한다", async () => {
    hooks.useState
      .mockReturnValueOnce(["native", vi.fn()])
      .mockReturnValueOnce([{ prompt: vi.fn() }, vi.fn()]);

    const bannerModule = await loadBanner();
    if (!bannerModule) return;
    const html = renderToStaticMarkup(bannerModule.InstallPwaBanner());

    expect(html).toContain("text-body-15");
    expect(html).not.toContain("text-body-14");
  });

  it("iPhone에서는 거짓 설치 버튼 대신 홈 화면 추가 방법을 보여 준다", async () => {
    hooks.useState
      .mockReturnValueOnce(["ios", vi.fn()])
      .mockReturnValueOnce([null, vi.fn()]);

    const bannerModule = await loadBanner();
    if (!bannerModule) return;
    const { InstallPwaBanner } = bannerModule;
    const html = renderToStaticMarkup(InstallPwaBanner());

    expect(html).toContain("설치 방법");
    expect(html).toContain("공유");
    expect(html).toContain("홈 화면에 추가");
    expect(html).not.toContain("<button");
  });

  it("다른 경로에서 설치가 끝나도 열린 배너를 바로 닫는다", async () => {
    let effect: (() => void | (() => void)) | undefined;
    const listeners = new Map<string, EventListener>();
    const setMode = vi.fn();
    const setPrompt = vi.fn();
    hooks.useState
      .mockReturnValueOnce(["native", setMode])
      .mockReturnValueOnce([{ prompt: vi.fn() }, setPrompt]);
    hooks.useEffect.mockImplementation((callback) => {
      effect = callback;
    });
    vi.stubGlobal("navigator", {
      maxTouchPoints: 0,
      platform: "Linux armv8l",
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
    });
    vi.stubGlobal("window", {
      addEventListener: (type: string, listener: EventListener) =>
        listeners.set(type, listener),
      matchMedia: () => ({ matches: false }),
      removeEventListener: vi.fn(),
    });

    const bannerModule = await loadBanner();
    if (!bannerModule) return;
    bannerModule.InstallPwaBanner();
    effect?.();
    listeners.get("appinstalled")?.(new Event("appinstalled"));

    expect(setPrompt).toHaveBeenCalledWith(null);
    expect(setMode).toHaveBeenCalledWith("hidden");
  });

  it("이미 홈 화면 앱으로 실행 중이면 iPhone 안내도 열지 않는다", async () => {
    let effect: (() => void | (() => void)) | undefined;
    const setMode = vi.fn();
    hooks.useState
      .mockReturnValueOnce(["hidden", setMode])
      .mockReturnValueOnce([null, vi.fn()]);
    hooks.useEffect.mockImplementation((callback) => {
      effect = callback;
    });
    vi.stubGlobal("navigator", {
      maxTouchPoints: 5,
      platform: "iPhone",
      standalone: true,
      userAgent: "Mozilla/5.0 (iPhone)",
    });
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      matchMedia: () => ({ matches: false }),
      removeEventListener: vi.fn(),
    });

    const bannerModule = await loadBanner();
    if (!bannerModule) return;
    const { InstallPwaBanner } = bannerModule;
    InstallPwaBanner();
    effect?.();
    await Promise.resolve();

    expect(setMode).not.toHaveBeenCalled();
  });
});
