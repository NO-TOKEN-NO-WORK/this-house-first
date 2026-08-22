"use client";

import { useEffect } from "react";

export async function registerNotificationServiceWorker(
  serviceWorker: Pick<ServiceWorkerContainer, "getRegistrations" | "register">,
) {
  const registrations = await serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter(({ scope }) => {
        const pathname = new URL(scope).pathname;
        return pathname === "/today" || pathname === "/today/";
      })
      .map((registration) => registration.unregister()),
  );
  await serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

/** production에서 담당자·관리자 알림을 받는 루트 Service Worker를 등록한다 (ADR-0017). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    registerNotificationServiceWorker(navigator.serviceWorker).catch(() => {
      // 등록 실패는 치명적이지 않다 — 앱은 일반 웹으로 동작
    });
  }, []);
  return null;
}
