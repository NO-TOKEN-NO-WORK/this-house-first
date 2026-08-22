"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../../app/admin/admin.module.css";
import type { AdminDashboardBuilding } from "../../lib/admin/dashboard";
import { GRADE_LABEL } from "../../lib/domain";

type KakaoLatLng = object;

type KakaoMap = {
  setBounds(bounds: KakaoLatLngBounds): void;
  setZoomable(zoomable: boolean): void;
};

type KakaoLatLngBounds = {
  extend(position: KakaoLatLng): void;
};

type KakaoOverlay = {
  setMap(map: null): void;
};

type KakaoMarker = object;

type KakaoCluster = {
  getClusterMarker(): { getContent(): Node | string };
  getMarkers(): KakaoMarker[];
  getSize(): number;
};

type KakaoMarkerClusterer = {
  addMarkers(markers: KakaoMarker[]): void;
  clear(): void;
};

type KakaoEvent = {
  addListener(
    target: KakaoMarkerClusterer,
    type: "clusterclick",
    handler: (cluster: KakaoCluster) => void,
  ): void;
  addListener(
    target: KakaoMarkerClusterer,
    type: "clustered",
    handler: (clusters: KakaoCluster[]) => void,
  ): void;
  removeListener(
    target: KakaoMarkerClusterer,
    type: "clusterclick",
    handler: (cluster: KakaoCluster) => void,
  ): void;
  removeListener(
    target: KakaoMarkerClusterer,
    type: "clustered",
    handler: (clusters: KakaoCluster[]) => void,
  ): void;
};

type KakaoMaps = {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Size: new (width: number, height: number) => object;
  MarkerImage: new (src: string, size: object) => object;
  Marker: new (options: {
    position: KakaoLatLng;
    image: object;
    title: string;
    clickable: boolean;
    opacity: number;
  }) => KakaoMarker;
  MarkerClusterer: new (options: {
    map: KakaoMap;
    averageCenter: boolean;
    minClusterSize: number;
    minLevel: number;
    disableClickZoom: boolean;
    calculator: number[];
    texts(count: number): string;
    styles: Array<Record<string, string>>;
  }) => KakaoMarkerClusterer;
  event: KakaoEvent;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  CustomOverlay: new (options: {
    map: KakaoMap;
    position: KakaoLatLng;
    clickable: boolean;
    content: HTMLElement;
    yAnchor: number;
  }) => KakaoOverlay;
};

function buildingIconSrc(grade: AdminDashboardBuilding["grade"]): string {
  if (grade === 1) return "/admin/building-critical.png";
  if (grade === 2) return "/admin/building-high.png";
  return "/admin/building-moderate.png";
}

export function clusterMarkerText(count: number): string {
  if (count >= 10) return "10+";
  if (count >= 5) return "5+";
  return String(count);
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
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(mapKey)}&autoload=false&libraries=clusterer`;
    script.async = true;
    subscribe(script);
    document.head.appendChild(script);
  });
}

export function ClusterBuildingTray({
  buildings,
  selectedBuildingId,
  onSelect,
}: {
  buildings: AdminDashboardBuilding[];
  selectedBuildingId: string | null;
  onSelect(buildingId: string): void;
}) {
  return (
    <section
      className={styles.mapClusterTray}
      aria-label={`선택한 지역의 건물 ${buildings.length}개`}
    >
      <ul className={styles.mapClusterList}>
        {buildings.map((building) => (
          <li key={building.buildingId}>
            <button
              aria-pressed={building.buildingId === selectedBuildingId}
              className={styles.mapClusterCard}
              onClick={() => onSelect(building.buildingId)}
              type="button"
            >
              <Image
                alt=""
                aria-hidden="true"
                height={24}
                src={buildingIconSrc(building.grade)}
                width={24}
              />
              <span>
                <strong>{building.address.split(" ").slice(-2).join(" ")}</strong>
                <small>건물 위험 {GRADE_LABEL[building.grade]}</small>
              </span>
              <em>미처리 {building.openCount}명</em>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdminMap({
  buildings,
  mapKey,
  date,
}: {
  buildings: AdminDashboardBuilding[];
  mapKey: string;
  date?: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    buildings[0]?.buildingId ?? null,
  );
  const [clusterBuildingIds, setClusterBuildingIds] = useState<string[]>([]);
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
  const clusterBuildings = clusterBuildingIds.flatMap((buildingId) => {
    const building = buildings.find((candidate) => candidate.buildingId === buildingId);
    return building ? [building] : [];
  });
  const coordinateError =
    mapKey && mappedBuildings.length === 0
      ? "지도에 표시할 수 있는 건물 좌표가 없습니다."
      : null;

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!mapKey || !container) return;

    let cancelled = false;
    const overlays: KakaoOverlay[] = [];
    let cleanupClusterer = () => undefined;
    const cleanupMap = () => {
      cleanupClusterer();
      cleanupKakaoMap(overlays, container);
    };

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
              map.setZoomable(false);
              const bounds = new maps.LatLngBounds();
              const buildingByMarker = new Map<KakaoMarker, AdminDashboardBuilding>();
              const buttonByMarker = new Map<KakaoMarker, HTMLButtonElement>();
              const markers: KakaoMarker[] = [];

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
                button.append(icon);
                button.setAttribute(
                  "aria-label",
                  `${building.address}, ${GRADE_LABEL[building.grade]}, 미처리 ${building.openCount}명`,
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
                  setClusterBuildingIds([]);
                  setSelectedBuildingId(building.buildingId);
                });
                overlays.push(
                  new maps.CustomOverlay({
                    map,
                    position,
                    clickable: true,
                    content: button,
                    yAnchor: 0.5,
                  }),
                );
                const marker = new maps.Marker({
                  position,
                  image: new maps.MarkerImage(
                    buildingIconSrc(building.grade),
                    new maps.Size(32, 32),
                  ),
                  title: `${building.address}, ${GRADE_LABEL[building.grade]}`,
                  clickable: false,
                  opacity: 0,
                });
                markers.push(marker);
                buildingByMarker.set(marker, building);
                buttonByMarker.set(marker, button);
                bounds.extend(position);
              }

              map.setBounds(bounds);
              const clusterStyle = {
                display: "flex",
                width: "40px",
                height: "40px",
                alignItems: "center",
                justifyContent: "center",
                border: "3px solid var(--admin-surface)",
                borderRadius: "50%",
                background: "var(--admin-accent)",
                boxShadow: "var(--admin-shadow-panel)",
                color: "var(--admin-on-accent)",
                fontSize: "13px",
                fontWeight: "800",
              };
              const clusterer = new maps.MarkerClusterer({
                map,
                averageCenter: true,
                minClusterSize: 2,
                minLevel: 0,
                disableClickZoom: true,
                calculator: [10],
                texts: clusterMarkerText,
                styles: [clusterStyle, { ...clusterStyle }],
              });
              const selectCluster = (cluster: KakaoCluster) => {
                const clusterBuildings = cluster.getMarkers().flatMap((marker) => {
                  const building = buildingByMarker.get(marker);
                  return building ? [building] : [];
                });
                setClusterBuildingIds(
                  clusterBuildings.map((building) => building.buildingId),
                );
                setSelectedBuildingId(clusterBuildings[0]?.buildingId ?? null);
              };
              const syncClusters = (clusters: KakaoCluster[]) => {
                setClusterBuildingIds([]);
                buttonByMarker.forEach((button) => {
                  button.hidden = false;
                });
                clusters.forEach((cluster) => {
                  if (cluster.getSize() < 2) return;
                  cluster.getMarkers().forEach((marker) => {
                    const button = buttonByMarker.get(marker);
                    if (button) button.hidden = true;
                  });
                  const content = cluster.getClusterMarker().getContent();
                  if (!(content instanceof HTMLElement)) return;
                  content.setAttribute("role", "button");
                  content.setAttribute("tabindex", "0");
                  content.setAttribute(
                    "aria-label",
                    `가까운 건물 ${cluster.getSize()}개 보기`,
                  );
                  content.onkeydown = (event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    selectCluster(cluster);
                  };
                });
              };
              cleanupClusterer = () => {
                maps.event.removeListener(clusterer, "clusterclick", selectCluster);
                maps.event.removeListener(clusterer, "clustered", syncClusters);
                clusterer.clear();
                cleanupClusterer = () => undefined;
              };
              maps.event.addListener(clusterer, "clusterclick", selectCluster);
              maps.event.addListener(clusterer, "clustered", syncClusters);
              clusterer.addMarkers(markers);
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
      <div className={styles.mapLayout}>
        <section
          className={styles.mapSelection}
          aria-label="선택한 대상자"
          aria-live="polite"
        >
          {selectedBuilding?.subjects[0] ? (
            <>
              <span className={styles.mapSelectionEyebrow}>선택 대상자</span>
              <div className={styles.mapSubject}>
                <Image
                  alt={`${selectedBuilding.subjects[0].name} 합성 프로필`}
                  className={styles.mapSubjectAvatar}
                  height={72}
                  src="/admin/elder-female-1.png"
                  width={72}
                />
                <div>
                  <h3 className={styles.mapDetailTitle}>
                    <strong>{selectedBuilding.subjects[0].name}</strong>
                    <span className={`${styles.badge} ${styles[`grade${selectedBuilding.subjects[0].grade}`]}`}>
                      {GRADE_LABEL[selectedBuilding.subjects[0].grade]}
                    </span>
                  </h3>
                  <span className={styles.statusBadge}>
                    {selectedBuilding.subjects[0].statusLabel}
                  </span>
                </div>
              </div>
              <dl className={styles.mapSelectionFacts}>
                <div><dt>담당자</dt><dd>{selectedBuilding.subjects[0].workerName}</dd></div>
                <div><dt>주소</dt><dd>{selectedBuilding.address}</dd></div>
              </dl>
              <ul
                className={styles.reasonList}
                aria-label={`${selectedBuilding.subjects[0].name} 위험 사유`}
              >
                {selectedBuilding.subjects[0].reasons.map((reason, index) => (
                  <li key={`${selectedBuilding.subjects[0].subjectId}-${index}`}>{reason}</li>
                ))}
              </ul>
              <Link
                className={styles.mapSelectionLink}
                href={`/admin/subjects/${selectedBuilding.subjects[0].subjectId}${date ? `?date=${date}` : ""}`}
              >
                대상자 상세 보기
              </Link>
            </>
          ) : (
            <p className={styles.mapSelectionEmpty}>건물 마커를 선택하면 대상자 정보가 표시됩니다.</p>
          )}
        </section>
        <div className={styles.mapViewport}>
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
                    height={32}
                    src={buildingIconSrc(building.grade)}
                    width={32}
                  />
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
          {clusterBuildings.length > 1 ? (
            <ClusterBuildingTray
              buildings={clusterBuildings}
              onSelect={setSelectedBuildingId}
              selectedBuildingId={selectedBuildingId}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
