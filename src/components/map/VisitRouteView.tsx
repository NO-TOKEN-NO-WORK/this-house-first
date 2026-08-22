"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { GRADE_CHIP, GRADE_CHIP_SUBTLE } from "@/components/today/gradeStyles";
import { GRADE_LABEL } from "@/lib/domain";
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

/**
 * 주소 앞 핀 (Figma 123:3149) — 하단 탭과 같은 글리프를 14.7×16.8408로 줄여 쓴다.
 *
 * 그리는 상자는 24px인데 사방 여백을 3px씩 깎아 자리는 Figma의 18px 그대로 차지한다.
 * 18px 상자에 그대로 담으면 위아래 여유가 0.58px뿐이라 `mask-clip: border-box`가
 * 기기에 따라 핀 윗머리를 깎는다 — 하단 탭에서 여유 0.84px로 이미 겪은 문제다
 * (b4a54ae, BottomNav). 여유를 3.58px로 늘린다. 음수 여백이 자리를 18px로 되돌리므로
 * 글리프가 그려지는 위치는 달라지지 않는다.
 */
const ADDRESS_PIN_MASK = {
  WebkitMaskImage: "url('/figma/visit-route-pin.svg')",
  WebkitMaskPosition: "center",
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskSize: "14.7px 16.8408px",
  maskImage: "url('/figma/visit-route-pin.svg')",
  maskPosition: "center",
  maskRepeat: "no-repeat",
  maskSize: "14.7px 16.8408px",
} as const;

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
      /*
       * 마커는 Figma 38:5661의 26px 원형 배지다 — 카드 앞 번호 배지와 같은 `GRADE_CHIP`을
       * 쓰므로 같은 등급이 지도와 목록에서 같은 색으로 보인다.
       * 누르는 상자는 48px로 남긴다: 26px은 60대 사용자가 지도 위에서 누르기 어렵다 (PRD §9).
       */
      const button = document.createElement("button");
      button.type = "button";
      button.className = "flex size-12 items-center justify-center";
      const badge = document.createElement("span");
      badge.className = `flex size-[26px] items-center justify-center rounded-full text-label-14 drop-shadow-sm ${GRADE_CHIP[stop.grade]}`;
      badge.textContent = String(index + 1);
      button.append(badge);
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
          yAnchor: 0.5,
          zIndex: 3,
        }),
      );
    }

    /*
     * 구간 이동시간 (Figma 38:5669) — 두 가구의 중간 지점에 얹는다.
     * 그리는 선은 카카오 도로 좌표라 라벨이 선 위에 정확히 얹히지는 않는다.
     *
     * 0분 구간은 건너뛴다. 대상자 좌표는 건물 좌표라 한 건물에 여러 가구가 있으면
     * 중간 지점이 그 건물이 되어 `0분`이 번호 배지 위에 포개진다.
     *
     * 배경 없는 맨 글자는 Figma(38:5669) 그대로지만, 그 지도는 회색 목업이다.
     * 실제 지도 타일에는 도로명·건물명이 이미 깔려 있어 흰 알약을 깔지 않으면
     * 이 화면의 유일한 구간 시간 표시가 읽히지 않는다 (ADR-0014의 접근성 예외와 같은 이유).
     */
    for (const [index, stop] of route.stops.entries()) {
      const previous = route.stops[index - 1];
      if (!previous || stop.minutesFromPrevious === 0) continue;
      const label = document.createElement("span");
      label.className =
        "rounded-full bg-surface-default px-1.5 py-0.5 text-body-14 text-text-strong drop-shadow-sm";
      label.textContent = `${stop.minutesFromPrevious}분`;
      overlays.push(
        new maps.CustomOverlay({
          map,
          position: new maps.LatLng(
            (previous.lat + stop.lat) / 2,
            (previous.lng + stop.lng) / 2,
          ),
          content: label,
          xAnchor: 0.5,
          yAnchor: 1.4,
          zIndex: 2,
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
        aria-label="방문 순서와 이동 경로가 표시된 지도"
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

/** 지도 + 합계 한 줄 (Figma 38:5659). */
function RouteOverview({
  apiKey,
  route,
}: {
  apiKey: string | undefined;
  route: VisitRoute;
}) {
  return (
    <section
      aria-label="방문 동선 요약"
      className="overflow-hidden rounded-[10px] border border-border-default bg-surface-default"
    >
      <VisitRouteMap apiKey={apiKey} route={route} />

      <p className="flex items-center gap-2 border-t border-border-default px-3.5 pt-3 pb-[11px] text-label-16 text-text-primary">
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
        예상 이동 {route.totalMinutes}분 · 총 {route.stops.length}가구
      </p>
    </section>
  );
}

/** 방문지 카드 한 장 (Figma 38:5680). */
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
          className={`shrink-0 rounded-full px-3 py-1.5 text-caption-12 ${GRADE_CHIP_SUBTLE[stop.grade]}`}
        >
          {GRADE_LABEL[stop.grade]}
        </span>
      </div>

      <p className="flex min-w-0 items-center gap-1.5 text-body-15-relaxed text-text-secondary">
        <span
          aria-hidden="true"
          className="-m-[3px] size-[24px] shrink-0 bg-icon-secondary"
          style={ADDRESS_PIN_MASK}
        />
        <span className="truncate">{stop.address}</span>
      </p>

      <a
        href={kakaoDirectionsHref(stop)}
        target="_blank"
        rel="noreferrer"
        aria-label={`${stop.name}님 경로 안내`}
        className="flex min-h-11 w-full items-center justify-center rounded-md bg-action-secondary px-4 py-2 text-label-15 text-text-inverse active:bg-action-secondary-strong"
      >
        경로 안내
      </a>
    </li>
  );
}

/** 담당자 방문 동선 (FR-7, Figma 38:5652). */
export function VisitRouteView({ apiKey, initialRoute, routeApiUrl }: Props) {
  const [resolved, setResolved] = useState<{
    base: VisitRoute;
    route: VisitRoute;
  } | null>(null);
  const route = resolved?.base === initialRoute ? resolved.route : initialRoute;

  useEffect(() => {
    if (initialRoute.stops.length === 0) return;
    const controller = new AbortController();
    let active = true;

    void fetch(routeApiUrl, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as { data?: VisitRoute };
        if (active) {
          setResolved({
            base: initialRoute,
            route: payload.data ?? initialRoute,
          });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("방문 경로를 갱신하지 못해 초기 예상치를 유지합니다.", error);
        if (active) {
          setResolved({ base: initialRoute, route: initialRoute });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [initialRoute, routeApiUrl]);

  return (
    <div className="flex flex-col gap-3">
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
