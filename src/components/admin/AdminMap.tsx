"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../../app/admin/admin.module.css";
import type { AdminDashboardBuilding } from "../../lib/admin/dashboard";
import { GRADE_LABEL } from "../../lib/domain";

type KakaoLatLng = object;

type KakaoMap = {
  setBounds(bounds: KakaoLatLngBounds): void;
};

type KakaoLatLngBounds = {
  extend(position: KakaoLatLng): void;
};

type KakaoOverlay = {
  setMap(map: null): void;
};

type KakaoMaps = {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  CustomOverlay: new (options: {
    map: KakaoMap;
    position: KakaoLatLng;
    content: HTMLElement;
    yAnchor: number;
  }) => KakaoOverlay;
};

function getKakaoMaps(): KakaoMaps | undefined {
  return (window as Window & { kakao?: { maps: KakaoMaps } }).kakao?.maps;
}

export function cleanupKakaoMap(
  overlays: Array<{ setMap(map: null): void }>,
  container: { replaceChildren(): void },
) {
  overlays.splice(0).forEach((overlay) => overlay.setMap(null));
  container.replaceChildren();
}

export function isValidMapCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function adminMapBuildingsSignature(
  buildings: AdminDashboardBuilding[],
): string {
  return JSON.stringify(buildings);
}

export function loadKakaoSdk(mapKey: string): Promise<KakaoMaps> {
  const loadedMaps = getKakaoMaps();
  if (loadedMaps) return Promise.resolve(loadedMaps);

  return new Promise((resolve, reject) => {
    const subscribe = (script: HTMLScriptElement) => {
      script.addEventListener(
        "load",
        () => {
          const maps = getKakaoMaps();
          if (maps) resolve(maps);
          else {
            script.remove();
            reject(new Error("카카오 지도 SDK를 초기화할 수 없습니다."));
          }
        },
        { once: true },
      );
      script.addEventListener(
        "error",
        () => {
          script.remove();
          reject(new Error("카카오 지도 SDK를 불러올 수 없습니다."));
        },
        { once: true },
      );
    };
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-admin-kakao-map]",
    );

    if (existing) {
      subscribe(existing);
      return;
    }

    const script = document.createElement("script");
    script.dataset.adminKakaoMap = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(mapKey)}&autoload=false`;
    script.async = true;
    subscribe(script);
    document.head.appendChild(script);
  });
}

export function AdminMap({
  buildings,
  mapKey,
}: {
  buildings: AdminDashboardBuilding[];
  mapKey: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const buildingsSignature = adminMapBuildingsSignature(buildings);
  const mappedBuildings = useMemo(
    () =>
      (JSON.parse(buildingsSignature) as AdminDashboardBuilding[]).filter(
        (building) => isValidMapCoordinate(building.lat, building.lng),
      ),
    [buildingsSignature],
  );
  const selectedBuilding = buildings.find(
    (building) => building.buildingId === selectedBuildingId,
  );
  const coordinateError =
    mapKey && mappedBuildings.length === 0
      ? "지도에 표시할 수 있는 건물 좌표가 없습니다."
      : null;

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!mapKey || !container) return;

    let cancelled = false;
    const overlays: KakaoOverlay[] = [];
    const cleanupMap = () => cleanupKakaoMap(overlays, container);

    if (mappedBuildings.length === 0) {
      return cleanupMap;
    }

    void loadKakaoSdk(mapKey)
      .then((maps) => {
        try {
          maps.load(() => {
            if (cancelled) return;

            try {
              const firstBuilding = mappedBuildings[0];
              const map = new maps.Map(container, {
                center: new maps.LatLng(firstBuilding.lat, firstBuilding.lng),
                level: 6,
              });
              const bounds = new maps.LatLngBounds();

              for (const building of mappedBuildings) {
                const position = new maps.LatLng(building.lat, building.lng);
                const button = document.createElement("button");
                button.type = "button";
                button.className = `${styles.mapMarker} ${styles[`grade${building.grade}`]} ${styles[building.statusCategory]}`;
                button.textContent = String(building.openCount);
                button.setAttribute(
                  "aria-label",
                  `${building.address}, ${building.grade}등급, 미처리 ${building.openCount}명`,
                );
                const statusLabels = [
                  ...new Set(building.subjects.map((subject) => subject.statusLabel)),
                ];
                if (statusLabels.length > 0) {
                  button.setAttribute(
                    "aria-description",
                    `가구 상태: ${statusLabels.join(", ")}`,
                  );
                }
                button.addEventListener("click", () => {
                  setSelectedBuildingId(building.buildingId);
                });
                overlays.push(
                  new maps.CustomOverlay({
                    map,
                    position,
                    content: button,
                    yAnchor: 1,
                  }),
                );
                bounds.extend(position);
              }

              map.setBounds(bounds);
              setMapError(null);
            } catch {
              if (!cancelled) {
                cleanupMap();
                setMapError("카카오 지도를 초기화하지 못했습니다. 잠시 후 다시 시도해 주세요.");
              }
            }
          });
        } catch {
          if (!cancelled) {
            cleanupMap();
            setMapError("카카오 지도를 초기화하지 못했습니다. 잠시 후 다시 시도해 주세요.");
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          cleanupMap();
          setMapError("카카오 지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      });

    return () => {
      cancelled = true;
      cleanupMap();
    };
  }, [mapKey, mappedBuildings]);

  return (
    <section className={styles.map} aria-labelledby="map-title">
      <h2 id="map-title" className={styles.sectionTitle}>
        건물 위험도 지도
      </h2>
      {!mapKey ? (
        <p className={styles.mapMessage}>
          카카오 지도 키가 설정되지 않았습니다. 우선 대상자 목록은 계속 확인할 수 있습니다.
        </p>
      ) : (
        <>
          <div
            ref={mapContainerRef}
            className={styles.mapCanvas}
            role="region"
            aria-label="건물 위험도 지도"
          />
          {coordinateError ?? mapError ? (
            <p className={styles.mapMessage} role="alert">
              {coordinateError ?? mapError}
            </p>
          ) : null}
          <section
            className={styles.mapDetail}
            aria-label="선택한 건물 상세"
            aria-live="polite"
          >
            {selectedBuilding ? (
              <>
                <h3 className={styles.mapDetailTitle}>{selectedBuilding.address}</h3>
                <ul className={styles.mapSubjectList}>
                  {selectedBuilding.subjects.map((subject) => (
                    <li key={subject.subjectId} className={styles.mapSubject}>
                      <p>
                        {subject.name} · {GRADE_LABEL[subject.grade]} · {subject.statusLabel}
                      </p>
                      <ul className={styles.reasonList} aria-label={`${subject.name} 위험 사유`}>
                        {subject.reasons.map((reason, index) => (
                          <li key={`${subject.subjectId}-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className={styles.mapMessage}>지도 마커를 선택하면 건물 상세를 확인할 수 있습니다.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
