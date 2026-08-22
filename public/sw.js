/**
 * 오늘의 대응 보드 전용 Service Worker (ADR-0006)
 * - 페이지 이동: network-first, 실패 시 캐시 폴백 (농촌 음영지역 오프라인 내성 — PRD §9 v0 수준)
 * - 정적 자원: cache-first
 * - 캐시를 갱신하려면 CACHE_VERSION을 올린다 (자동 precache 없음 — ADR-0006 트레이드오프)
 */
const CACHE_VERSION = "thf-today-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key === "thf-v1" ||
              (key.startsWith("thf-today-") && key !== CACHE_VERSION),
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API 응답은 캐시하지 않는다 — 가구 상태는 항상 최신이어야 한다
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cached = await caches.match(request);
          return cached ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, response.clone());
        }
        return response;
      })(),
    );
  }
});
