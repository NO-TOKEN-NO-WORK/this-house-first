"use client";

import { useEffect, useState } from "react";

type InstallMode = "hidden" | "native" | "ios";

interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

interface InstallPromptWindow extends Window {
  __thfInstallPrompt?: InstallPromptEvent;
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as StandaloneNavigator).standalone === true
  );
}

/** 설치할 수 있을 때만 보이는 담당자 PWA 설치 배너. */
export function InstallPwaBanner() {
  const [mode, setMode] = useState<InstallMode>("hidden");
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;

    const installWindow = window as InstallPromptWindow;
    let cancelled = false;
    if (isIosDevice()) {
      void Promise.resolve().then(() => {
        if (!cancelled) setMode("ios");
      });
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      delete installWindow.__thfInstallPrompt;
      setInstallPrompt(event as InstallPromptEvent);
      setMode("native");
    }

    function onAppInstalled() {
      delete installWindow.__thfInstallPrompt;
      setInstallPrompt(null);
      setMode("hidden");
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    const bufferedPrompt = installWindow.__thfInstallPrompt;
    if (bufferedPrompt) {
      void Promise.resolve().then(() => {
        if (!cancelled) onBeforeInstallPrompt(bufferedPrompt);
      });
    }
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  async function install() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
    } catch {
      // 브라우저 메뉴에서 다시 설치할 수 있으므로 배너만 정리한다.
    } finally {
      setInstallPrompt(null);
      setMode("hidden");
    }
  }

  return (
    <section
      aria-label="앱 설치"
      className="rounded-lg border border-border-default bg-surface-default p-4 text-text-primary"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-label-16">홈 화면에 앱 설치</p>
          <p className="text-body-15 text-text-secondary">
            자주 쓰는 화면을 앱처럼 바로 열 수 있어요.
          </p>
        </div>
        {mode === "native" ? (
          <button
            type="button"
            onClick={install}
            className="min-h-12 shrink-0 rounded-lg bg-action-primary px-4 text-label-15 text-text-inverse"
          >
            앱 설치
          </button>
        ) : null}
      </div>
      {mode === "ios" ? (
        <details className="mt-3">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center rounded-lg bg-action-primary px-4 text-label-15 text-text-inverse">
            설치 방법
          </summary>
          <p className="mt-3 text-body-15-relaxed text-text-secondary">
            브라우저의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해 주세요.
          </p>
        </details>
      ) : null}
    </section>
  );
}
