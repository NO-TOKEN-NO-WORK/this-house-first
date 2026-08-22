"use client";

import { useEffect } from "react";

export async function registerTodayServiceWorker(
  serviceWorker: Pick<ServiceWorkerContainer, "getRegistrations" | "register">,
  origin: string,
) {
  const registrations = await serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter(({ scope }) => scope === `${origin}/`)
      .map((registration) => registration.unregister()),
  );
  await serviceWorker.register("/sw.js", { scope: "/today" });
}

/** production에서만 오늘의 대응 보드 범위로 등록한다 (ADR-0006). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    registerTodayServiceWorker(
      navigator.serviceWorker,
      window.location.origin,
    ).catch(() => {
      // 등록 실패는 치명적이지 않다 — 앱은 일반 웹으로 동작
    });
  }, []);
  return null;
}
