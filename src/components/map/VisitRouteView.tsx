"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { GRADE_CHIP } from "@/components/today/gradeStyles";
import { GRADE_LABEL, RiskGrade } from "@/lib/domain";
import type { KakaoOverlay } from "@/lib/kakao/maps-sdk";
import {
  kakaoDirectionsHref,
  type VisitRoute,
  type VisitRouteStop,
} from "@/lib/map/route";

interface Props {
  apiKey: string | undefined;
  initialRoute: VisitRoute;
  routeApiUrl: string;
}

const ROUTE_GRADE_CHIP: Record<RiskGrade, string> = {
  [RiskGrade.CRITICAL]:
    "bg-status-critical-subtle text-status-critical-strong",
  [RiskGrade.HIGH]: "bg-status-warning-subtle text-status-warning-strong",
  [RiskGrade.MODERATE]: "bg-background-subtle text-text-supporting",
};

const MAP_PIN_TONE: Record<RiskGrade, string> = {
  [RiskGrade.CRITICAL]: "bg-status-critical",
  [RiskGrade.HIGH]: "bg-status-warning",
  [RiskGrade.MODERATE]: "bg-status-neutral",
};

const ROUTE_GRADES = [
  RiskGrade.CRITICAL,
  RiskGrade.HIGH,
  RiskGrade.MODERATE,
] as const;

function formatDistance(meters: number): string {
  if (meters < 1_000) return `${meters}m`;
  return `${(meters / 1_000).toFixed(1)}km`;
}

function VisitRouteMap({ apiKey, route }: { apiKey: string | undefined; route: VisitRoute }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  useEffect(() => {
    const maps = window.kakao?.maps;
    const container = containerRef.current;
    if (!ready || !maps || !container || route.stops.length === 0) return;

    const first = new maps.LatLng(route.stops[0].lat, route.stops[0].lng);
    const map = new maps.Map(container, { center: first, level: 3 });
    const bounds = new maps.LatLngBounds();
    const overlays: KakaoOverlay[] = [];
    const markerButtons: Array<{
      button: HTMLButtonElement;
      handler: () => void;
    }> = [];

    for (const [index, stop] of route.stops.entries()) {
      const position = new maps.LatLng(stop.lat, stop.lng);
      bounds.extend(position);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "relative flex size-12 items-center justify-center";
      const pin = document.createElement("span");
      pin.className = `absolute inset-0 bg-center bg-no-repeat drop-shadow-sm ${MAP_PIN_TONE[stop.grade]}`;
      pin.setAttribute("aria-hidden", "true");
      pin.style.webkitMaskImage = "url('/figma/visit-route-pin.svg')";
      pin.style.webkitMaskPosition = "center";
      pin.style.webkitMaskRepeat = "no-repeat";
      pin.style.webkitMaskSize = "36px 42px";
      pin.style.maskImage = "url('/figma/visit-route-pin.svg')";
      pin.style.maskPosition = "center";
      pin.style.maskRepeat = "no-repeat";
      pin.style.maskSize = "36px 42px";
      const number = document.createElement("span");
      number.className = "relative z-10 -translate-y-1 text-label-14 text-text-inverse";
      number.textContent = String(index + 1);
      button.append(pin, number);
      button.setAttribute(
        "aria-label",
        `${index + 1}번째 방문 ${stop.name}, ${GRADE_LABEL[stop.grade]}`,
      );
      const handler = () => {
        document.getElementById(`visit-stop-${stop.subjectId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      };
      button.addEventListener("click", handler);
      markerButtons.push({ button, handler });
      overlays.push(
        new maps.CustomOverlay({
          map,
          position,
          content: button,
          xAnchor: 0.5,
          yAnchor: 1,
          zIndex: 3,
        }),
      );
    }

    if (route.path.length > 1) {
      const css = getComputedStyle(document.documentElement);
      const color = css.getPropertyValue("--color-action-primary").trim();
      const path = route.path.map(({ lat, lng }) => {
        const point = new maps.LatLng(lat, lng);
        bounds.extend(point);
        return point;
      });
      overlays.push(
        new maps.Polyline({
          map,
          path,
          strokeWeight: 5,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeStyle: "solid",
        }),
      );
    }

    if (route.stops.length > 1) map.setBounds(bounds);
    else map.setLevel(3);

    return () => {
      for (const overlay of overlays) overlay.setMap(null);
      for (const { button, handler } of markerButtons) {
        button.removeEventListener("click", handler);
      }
    };
  }, [ready, route]);

  if (route.stops.length === 0) {
    return (
      <div className="flex aspect-[60/49] items-center justify-center bg-surface-soft px-8 text-center text-body-15-relaxed text-text-secondary">
        지금 방문할 가구가 없습니다.
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div
        role="alert"
        className="flex aspect-[60/49] items-center justify-center bg-surface-soft px-8 text-center text-body-15-relaxed text-text-secondary"
      >
        지도 키가 설정되지 않아 방문 목록만 표시합니다.
      </div>
    );
  }

  return (
    <div className="relative aspect-[60/49] w-full bg-surface-soft">
      <Script
        id="kakao-map-sdk"
        src={`https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${encodeURIComponent(apiKey)}`}
        strategy="afterInteractive"
        onReady={() => window.kakao?.maps.load(() => setReady(true))}
        onError={() => setScriptError(true)}
      />
      <div
        ref={containerRef}
        role="region"
        aria-label="방문 순서와 도보 경로가 표시된 카카오맵"
        className="size-full bg-map-road"
      />
      {!ready && !scriptError ? (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-surface-soft text-body-15 text-text-secondary"
        >
          지도를 불러오는 중입니다.
        </p>
      ) : null}
      {scriptError ? (
        <p
          role="alert"
          className="absolute inset-0 flex items-center justify-center bg-surface-soft px-8 text-center text-body-15-relaxed text-text-secondary"
        >
          지도를 불러오지 못했습니다. 방문 목록에서 경로 안내를 이용해 주세요.
        </p>
      ) : null}
    </div>
  );
}

function RouteOverview({ apiKey, route }: { apiKey: string | undefined; route: VisitRoute }) {
  return (
    <section
      aria-label="방문 동선 요약"
      className="overflow-hidden rounded-[10px] border border-border-default bg-surface-default"
    >
      <VisitRouteMap apiKey={apiKey} route={route} />

      {route.stops.length > 0 ? (
        <div className="flex flex-wrap gap-3 border-t border-border-default px-3.5 py-3">
          {ROUTE_GRADES.map((grade) => (
            <span key={grade} className="flex items-center gap-1.5 text-body-14 text-text-secondary">
              <span aria-hidden="true" className={`size-2.5 rounded-full ${MAP_PIN_TONE[grade]}`} />
              {GRADE_LABEL[grade]}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex min-h-14 flex-col justify-center gap-1 border-t border-border-default px-3.5">
        <p className="flex items-center gap-2 text-label-15 text-text-primary">
          <span
            aria-hidden="true"
            className="size-[17px] shrink-0 bg-icon-secondary"
            style={{
              WebkitMaskImage: "url('/figma/visit-route-clock.svg')",
              WebkitMaskPosition: "center",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskSize: "17px 17px",
              maskImage: "url('/figma/visit-route-clock.svg')",
              maskPosition: "center",
              maskRepeat: "no-repeat",
              maskSize: "17px 17px",
            }}
          />
          예상 이동 {route.totalMinutes}분 · {formatDistance(route.totalMeters)} · 총 {route.stops.length}가구
        </p>
        <p className="text-caption-12 text-text-tertiary">
          {route.source === "kakao" ? "카카오맵 최단 도보 경로 기준" : "직선거리 기반 예상치"}
        </p>
      </div>
    </section>
  );
}

function VisitCard({ stop, order }: { stop: VisitRouteStop; order: number }) {
  return (
    <li
      id={`visit-stop-${stop.subjectId}`}
      className="flex scroll-mt-4 flex-col gap-2 rounded-[10px] border border-border-default bg-surface-default px-[18px] py-5"
    >
      <div className="flex min-w-0 items-center gap-[9px]">
        <span
          aria-hidden="true"
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-label-14 ${GRADE_CHIP[stop.grade]}`}
        >
          {order}
        </span>
        <p className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 text-heading-18 text-text-primary">{stop.name}</span>
          <span className="truncate text-body-14 text-text-secondary">
            {stop.age}세{stop.livesAlone ? " · 독거" : ""}
          </span>
        </p>
        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-caption-12 ${ROUTE_GRADE_CHIP[stop.grade]}`}
        >
          {GRADE_LABEL[stop.grade]}
        </span>
      </div>

      {order > 1 ? (
        <p className="text-label-14 text-action-primary-strong">
          이전 방문지에서 도보 {stop.minutesFromPrevious}분 · {formatDistance(stop.metersFromPrevious)}
        </p>
      ) : null}

      <p className="truncate text-body-15-relaxed text-text-secondary">{stop.address}</p>

      <ul
        aria-label={`${stop.name} 위험 사유`}
        className="list-disc space-y-1 pl-5 text-body-14 text-text-secondary"
      >
        {stop.reasons.map((reason, index) => (
          <li key={`${stop.subjectId}-reason-${index}`}>{reason}</li>
        ))}
      </ul>

      <a
        href={kakaoDirectionsHref(stop)}
        target="_blank"
        rel="noreferrer"
        aria-label={`${stop.name}님 경로 안내`}
        className="flex min-h-12 w-full items-center justify-center rounded-md bg-action-secondary px-4 text-label-15 text-text-inverse active:bg-action-secondary-strong"
      >
        경로 안내
      </a>
    </li>
  );
}

/** 담당자 방문 동선 (FR-7, Figma 25:460). */
export function VisitRouteView({ apiKey, initialRoute, routeApiUrl }: Props) {
  const [resolved, setResolved] = useState<{
    base: VisitRoute;
    route: VisitRoute;
  } | null>(null);
  const route = resolved?.base === initialRoute ? resolved.route : initialRoute;

  useEffect(() => {
    if (initialRoute.stops.length === 0) return;
    const controller = new AbortController();

    void fetch(routeApiUrl, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as { data?: VisitRoute };
        if (payload.data) setResolved({ base: initialRoute, route: payload.data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("방문 경로를 갱신하지 못해 초기 예상치를 유지합니다.", error);
      });

    return () => controller.abort();
  }, [initialRoute, routeApiUrl]);

  return (
    <div className="flex flex-col gap-3">
      {route.stops.length > 0 ? (
        <p className="text-body-15-relaxed text-text-secondary">
          {GRADE_LABEL[RiskGrade.CRITICAL]} → {GRADE_LABEL[RiskGrade.HIGH]} → {GRADE_LABEL[RiskGrade.MODERATE]} 순으로 방문합니다.
        </p>
      ) : null}
      <RouteOverview apiKey={apiKey} route={route} />
      {route.stops.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {route.stops.map((stop, index) => (
            <VisitCard key={stop.subjectId} stop={stop} order={index + 1} />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
