/**
 * 오늘의 대응 보드 전용 Service Worker (ADR-0006)
 * - 페이지 이동: network-first, 실패 시 캐시 폴백 (농촌 음영지역 오프라인 내성 — PRD §9 v0 수준)
 * - 정적 자원: cache-first
 * - 캐시를 갱신하려면 CACHE_VERSION을 올린다 (자동 precache 없음 — ADR-0006 트레이드오프)
 */
const CACHE_VERSION = "thf-today-v3";

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
    // 루트 scope는 관리자 Push 구독에도 필요하지만 페이지 캐시는 담당자 PWA만 책임진다.
    if (url.pathname !== "/today" && !url.pathname.startsWith("/today/")) return;
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

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  if (!data || typeof data.title !== "string" || typeof data.body !== "string") {
    return;
  }
  const options = {
    body: data.body,
    icon: typeof data.icon === "string" ? data.icon : "/icons/icon.svg",
    badge: typeof data.badge === "string" ? data.badge : "/icons/icon.svg",
    tag: typeof data.tag === "string" ? data.tag : undefined,
    renotify: Boolean(data.urgent),
    data: { href: typeof data.href === "string" ? data.href : "/today" },
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawHref = event.notification.data?.href;
  const target = new URL(
    typeof rawHref === "string" ? rawHref : "/today",
    self.location.origin,
  );
  const href = target.origin === self.location.origin ? target.href : `${self.location.origin}/today`;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        const existing = windows[0];
        if (existing) {
          if ("navigate" in existing) await existing.navigate(href);
          return existing.focus();
        }
        return self.clients.openWindow(href);
      }),
  );
});
