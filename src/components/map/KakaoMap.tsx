"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { GRADE_LABEL, HouseholdStatus, RiskGrade } from "@/lib/domain";
import type { MapBuilding } from "@/lib/map/data";

interface Props {
  apiKey: string | undefined;
  buildings: MapBuilding[];
  date: string;
  workerId?: string;
}

interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

interface KakaoLatLngBounds {
  extend(position: KakaoLatLng): void;
}

interface KakaoMapInstance {
  setBounds(bounds: KakaoLatLngBounds): void;
  setLevel(level: number): void;
}

interface KakaoCircle {
  setMap(map: KakaoMapInstance | null): void;
}

interface KakaoMaps {
  load(callback: () => void): void;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMapInstance;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Circle: new (options: {
    map: KakaoMapInstance;
    center: KakaoLatLng;
    radius: number;
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
    clickable: boolean;
  }) => KakaoCircle;
  event: {
    addListener(target: KakaoCircle, type: "click", handler: () => void): void;
    removeListener(target: KakaoCircle, type: "click", handler: () => void): void;
  };
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

const STATUS_TONE: Record<HouseholdStatus, string> = {
  [HouseholdStatus.UNCHECKED]: "bg-info text-ink-strong",
  [HouseholdStatus.CALL_OK]: "bg-safe-soft text-safe-ink",
  [HouseholdStatus.NO_ANSWER_1]: "bg-warn-soft text-warn-ink",
  [HouseholdStatus.VISIT_QUEUED]: "bg-danger-soft text-danger-ink",
  [HouseholdStatus.VISITING]: "bg-brand-soft text-brand-deep",
  [HouseholdStatus.RESOLVED]: "bg-safe-soft text-safe-ink",
  [HouseholdStatus.EMERGENCY_119]: "bg-danger text-white",
  [HouseholdStatus.UNREACHABLE]: "bg-danger-soft text-danger-ink",
};

function subjectHref(subjectId: string, date: string, workerId?: string): string {
  const query = new URLSearchParams({ date });
  if (workerId) query.set("workerId", workerId);
  return `/today/${subjectId}?${query.toString()}`;
}

function buildingAddress(building: MapBuilding): string {
  return building.roadAddress ?? building.address;
}

export function KakaoMap({ apiKey, buildings, date, workerId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    buildings[0]?.buildingId ?? null,
  );

  useEffect(() => {
    const maps = window.kakao?.maps;
    const container = containerRef.current;
    if (!ready || !maps || !container || buildings.length === 0) return;

    const first = new maps.LatLng(buildings[0].lat, buildings[0].lng);
    const map = new maps.Map(container, { center: first, level: 3 });
    const bounds = new maps.LatLngBounds();
    const css = getComputedStyle(document.documentElement);
    const fillByGrade: Record<RiskGrade, string> = {
      [RiskGrade.CRITICAL]: css.getPropertyValue("--color-danger").trim(),
      [RiskGrade.HIGH]: css.getPropertyValue("--color-warn").trim(),
      [RiskGrade.MODERATE]: css.getPropertyValue("--color-calm").trim(),
    };
    const neutral = css.getPropertyValue("--color-slate").trim();
    const circles: Array<{ circle: KakaoCircle; handler: () => void }> = [];

    for (const building of buildings) {
      const center = new maps.LatLng(building.lat, building.lng);
      bounds.extend(center);
      const handler = () => setSelectedBuildingId(building.buildingId);
      const color = building.grade ? fillByGrade[building.grade] : neutral;
      const circle = new maps.Circle({
        map,
        center,
        radius: 35,
        strokeWeight: 3,
        strokeColor: color,
        strokeOpacity: 1,
        fillColor: color,
        fillOpacity: 0.55,
        clickable: true,
      });
      maps.event.addListener(circle, "click", handler);
      circles.push({ circle, handler });
    }

    if (buildings.length > 1) map.setBounds(bounds);
    else map.setLevel(3);

    return () => {
      for (const { circle, handler } of circles) {
        maps.event.removeListener(circle, "click", handler);
        circle.setMap(null);
      }
    };
  }, [buildings, ready]);

  if (!apiKey) {
    return <p role="alert">지도 키가 설정되지 않았습니다.</p>;
  }

  if (buildings.length === 0) {
    return <p>표시할 담당 가구가 없습니다.</p>;
  }

  const script = (
    <Script
      id="kakao-map-sdk"
      src={`https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${encodeURIComponent(apiKey)}`}
      strategy="afterInteractive"
      onReady={() => window.kakao?.maps.load(() => setReady(true))}
      onError={() => setError(true)}
    />
  );

  if (error) {
    return <p role="alert">지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>;
  }

  if (!ready) {
    return (
      <>
        {script}
        <p role="status">지도를 불러오는 중입니다.</p>
      </>
    );
  }

  const selectedBuilding =
    buildings.find((building) => building.buildingId === selectedBuildingId) ?? buildings[0];

  return (
    <div className="flex flex-col gap-4">
      {script}
      <div
        ref={containerRef}
        role="img"
        aria-label="담당 가구 위험 지도"
        className="h-80 w-full rounded-[10px] border border-line bg-info"
      />

      <section aria-labelledby="building-list-heading" className="flex flex-col gap-2">
        <h2 id="building-list-heading" className="text-base font-bold text-ink">
          건물 선택
        </h2>
        <ul className="flex flex-col gap-2">
          {buildings.map((building) => {
            const selected = building.buildingId === selectedBuilding.buildingId;
            return (
              <li key={building.buildingId}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedBuildingId(building.buildingId)}
                  className={`flex min-h-12 w-full items-center rounded-lg border px-4 text-left text-base font-bold ${
                    selected
                      ? "border-brand bg-brand-soft text-brand-deep"
                      : "border-line bg-white text-ink"
                  }`}
                >
                  {buildingAddress(building)}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="building-detail-heading"
        className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 id="building-detail-heading" className="text-lg font-bold text-ink">
            {buildingAddress(selectedBuilding)}
          </h2>
          <p className="text-base text-ink-soft">
            담당 대상자 {selectedBuilding.households.length}명
          </p>
          {selectedBuilding.grade !== null && (
            <p className="text-base font-bold text-ink">
              위험 등급 · {GRADE_LABEL[selectedBuilding.grade]}
            </p>
          )}
        </div>

        <ul className="flex flex-col gap-4">
          {selectedBuilding.households.map((household) => {
            return (
              <li
                key={household.subjectId}
                className="flex flex-col gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0"
              >
                <p className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-ink">{household.name}</span>
                  <span className="text-base text-ink-soft">{household.age}세</span>
                </p>

                {household.grade !== null &&
                  household.status !== null &&
                  household.statusLabel !== null && (
                  <div className="flex flex-col gap-3">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">
                        {GRADE_LABEL[household.grade]}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[15px] font-bold ${STATUS_TONE[household.status]}`}
                      >
                        {household.statusLabel}
                      </span>
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-base text-ink-soft">
                      {household.reasons.map((reason, index) => (
                        <li key={`${household.subjectId}-${index}`}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Link
                  href={subjectHref(household.subjectId, date, workerId)}
                  className="flex min-h-12 items-center justify-center rounded-lg bg-slate px-4 text-base font-bold text-white active:bg-ink-strong"
                >
                  대상자 확인
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
