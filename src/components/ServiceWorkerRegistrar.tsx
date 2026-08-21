"use client";

import { useEffect } from "react";

/** production에서만 /sw.js를 등록한다 (ADR-0006). dev에서는 캐시가 개발을 방해하므로 제외 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 등록 실패는 치명적이지 않다 — 앱은 일반 웹으로 동작
    });
  }, []);
  return null;
}
