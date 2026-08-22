"use client";

import Image from "next/image";
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

function buildingIconSrc(grade: AdminDashboardBuilding["grade"]): string {
  if (grade === 1) return "/admin/building-critical.png";
  if (grade === 2) return "/admin/building-high.png";
  return "/admin/building-moderate.png";
}

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
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    buildings[0]?.buildingId ?? null,
  );
  const buildingsSignature = adminMapBuildingsSignature(buildings);
  const mappedBuildings = useMemo(
    () =>
      (JSON.parse(buildingsSignature) as AdminDashboardBuilding[]).filter(
        (building) => isValidMapCoordinate(building.lat, building.lng),
      ),
    [buildingsSignature],
  );
  const selectedBuilding =
    buildings.find((building) => building.buildingId === selectedBuildingId) ??
    buildings[0];
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
                const icon = document.createElement("img");
                icon.src = buildingIconSrc(building.grade);
                icon.alt = "";
                icon.className = styles.mapMarkerIcon;
                icon.setAttribute("aria-hidden", "true");
                const copy = document.createElement("div");
                copy.className = styles.mapMarkerCopy;
                const address = document.createElement("strong");
                address.textContent = building.address.split(" ").slice(-2).join(" ");
                const grade = document.createElement("span");
                grade.textContent = `건물 위험 ${GRADE_LABEL[building.grade]}`;
                const open = document.createElement("em");
                open.textContent = `미처리 ${building.openCount}명`;
                copy.append(address, grade, open);
                button.append(icon, copy);
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
      <h2 id="map-title" className={styles.screenReaderOnly}>
        건물 위험도 지도
      </h2>
      {!mapKey ? (
        <div className={styles.mapFallback} role="region" aria-label="건물 위험도 지도">
          {mappedBuildings.slice(0, 5).map((building) => (
            <button
              aria-label={`${building.address}, ${GRADE_LABEL[building.grade]}, 미처리 ${building.openCount}명`}
              className={`${styles.mapMarker} ${styles.fallbackMarker} ${styles[`grade${building.grade}`]} ${styles[building.statusCategory]}`}
              key={building.buildingId}
              onClick={() => setSelectedBuildingId(building.buildingId)}
              type="button"
            >
              <Image
                alt=""
                aria-hidden="true"
                className={styles.mapMarkerIcon}
                height={24}
                src={buildingIconSrc(building.grade)}
                width={24}
              />
              <span className={styles.mapMarkerCopy}>
                <strong>{building.address.split(" ").slice(-2).join(" ")}</strong>
                <span>건물 위험 {GRADE_LABEL[building.grade]}</span>
                <em>미처리 {building.openCount}명</em>
              </span>
            </button>
          ))}
          <p className={styles.screenReaderOnly}>
            카카오 지도 키가 설정되지 않았습니다. 생성된 지도 이미지로 현황을 표시합니다.
          </p>
        </div>
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
        </>
      )}
      {selectedBuilding?.subjects[0] ? (
        <section
          className={styles.mapDetail}
          aria-label="선택한 건물 상세"
          aria-live="polite"
        >
          <span className={styles.mapDetailLabel}>최우선 대상</span>
          <Image
            alt=""
            aria-hidden="true"
            className={styles.mapDetailAlert}
            height={42}
            src="/admin/metric-critical.png"
            width={42}
          />
          <div className={styles.mapSubject}>
            <Image
              alt={`${selectedBuilding.subjects[0].name} 합성 프로필`}
              className={styles.mapSubjectAvatar}
              height={64}
              src="/admin/elder-female-1.png"
              width={64}
            />
            <div>
              <h3 className={styles.mapDetailTitle}>
                <strong>{selectedBuilding.subjects[0].name}</strong>
                <span className={`${styles.badge} ${styles[`grade${selectedBuilding.subjects[0].grade}`]}`}>
                  {GRADE_LABEL[selectedBuilding.subjects[0].grade]}
                </span>
                <span className={styles.statusBadge}>{selectedBuilding.subjects[0].statusLabel}</span>
              </h3>
              <p className={styles.mapSubjectMetaRow}>
                <span className={styles.mapSubjectMeta}>
                  <Image alt="" aria-hidden="true" height={14} src="/admin/person.png" width={14} />
                  담당자 {selectedBuilding.subjects[0].workerName}
                </span>
                <span className={styles.mapSubjectMeta}>
                  <Image alt="" aria-hidden="true" height={14} src="/admin/location.png" width={14} />
                  {selectedBuilding.address.split(" ").slice(0, 2).join(" ")}
                </span>
              </p>
            </div>
          </div>
          <ul
            className={styles.reasonList}
            aria-label={`${selectedBuilding.subjects[0].name} 위험 사유`}
          >
            {selectedBuilding.subjects[0].reasons.map((reason, index) => (
              <li key={`${selectedBuilding.subjects[0].subjectId}-${index}`}>{reason}</li>
            ))}
          </ul>
          <Image
            alt=""
            aria-hidden="true"
            className={styles.mapDetailPin}
            height={42}
            src="/admin/map-pin.png"
            width={32}
          />
        </section>
      ) : null}
    </section>
  );
}
