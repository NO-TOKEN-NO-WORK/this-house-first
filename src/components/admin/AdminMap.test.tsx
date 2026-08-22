import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AdminMap,
  ClusterBuildingTray,
  adminMapBuildingsSignature,
  cleanupKakaoMap,
  clusterMarkerText,
  isValidMapCoordinate,
  loadKakaoSdk,
} from "./AdminMap";

type FakeScript = {
  async: boolean;
  dataset: Record<string, string>;
  removed: boolean;
  src: string;
  addEventListener(event: string, listener: () => void): void;
  dispatch(event: string): void;
  remove(): void;
};

function createScriptDocument() {
  const scripts: FakeScript[] = [];

  return {
    document: {
      createElement: () => {
        const listeners = new Map<string, () => void>();
        const script: FakeScript = {
          async: false,
          dataset: {},
          removed: false,
          src: "",
          addEventListener(event, listener) {
            listeners.set(event, listener);
          },
          dispatch(event) {
            listeners.get(event)?.();
          },
          remove() {
            script.removed = true;
          },
        };
        return script;
      },
      head: {
        appendChild: (script: FakeScript) => {
          scripts.push(script);
          return script;
        },
      },
      querySelector: () => scripts.find((script) => !script.removed) ?? null,
    } as unknown as Document,
    scripts,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminMap", () => {
  it.each([
    [2, "2"],
    [3, "3"],
    [4, "4"],
    [5, "5+"],
    [9, "5+"],
    [10, "10+"],
    [15, "10+"],
  ])("군집 %i개는 %s 숫자 마커로 표시한다", (count, expected) => {
    expect(clusterMarkerText(count)).toBe(expected);
  });

  it("선택한 군집의 건물을 하단 카드 목록으로 보여준다", () => {
    const html = renderToStaticMarkup(
      <ClusterBuildingTray
        buildings={[
          {
            buildingId: "building-1",
            address: "대구광역시 서구 비산동 1",
            lat: 35.87,
            lng: 128.56,
            grade: 1,
            score: 31.5,
            statusCategory: "unchecked",
            openCount: 1,
            subjects: [],
          },
          {
            buildingId: "building-2",
            address: "대구광역시 서구 비산동 2",
            lat: 35.871,
            lng: 128.561,
            grade: 2,
            score: 18,
            statusCategory: "visit",
            openCount: 3,
            subjects: [],
          },
        ]}
        onSelect={() => undefined}
        selectedBuildingId="building-2"
      />,
    );

    expect(html).toContain('aria-label="선택한 지역의 건물 2개"');
    expect(html).toContain("비산동 1");
    expect(html).toContain("미처리 3명");
    expect(html).toContain('aria-pressed="true"');
  });

  it("마우스 휠은 페이지 스크롤을 가로채지 않는다", () => {
    const source = readFileSync(new URL("./AdminMap.tsx", import.meta.url), "utf8");
    expect(source).toContain("map.setZoomable(false)");
  });

  it("카카오 키가 없으면 목록을 막지 않는 설정 안내를 보여준다", () => {
    const html = renderToStaticMarkup(<AdminMap buildings={[]} mapKey="" />);
    expect(html).toContain("카카오 지도 키가 설정되지 않았습니다");
  });

  it("키와 건물이 있으면 접근 가능한 지도 영역을 만든다", () => {
    const html = renderToStaticMarkup(
      <AdminMap
        mapKey="test-key"
        buildings={[
          {
            buildingId: "building-1",
            address: "대구광역시 서구 비산동 1",
            lat: 35.87,
            lng: 128.56,
            grade: 1,
            score: 31.5,
            statusCategory: "unchecked",
            openCount: 1,
            subjects: [],
          },
        ]}
      />,
    );
    expect(html).toContain('aria-label="건물 위험도 지도"');
  });

  it("단일 마커는 주소 카드 대신 최소 건물 아이콘으로 표시한다", () => {
    const html = renderToStaticMarkup(
      <AdminMap
        mapKey=""
        buildings={[
          {
            buildingId: "building-1",
            address: "대구광역시 서구 비산동 1",
            lat: 35.87,
            lng: 128.56,
            grade: 2,
            score: 18,
            statusCategory: "unchecked",
            openCount: 1,
            subjects: [],
          },
        ]}
      />,
    );

    expect(html).toContain(
      'aria-label="대구광역시 서구 비산동 1, 경계, 미처리 1명"',
    );
    expect(html).not.toContain("건물 위험 경계</span>");
  });

  it("선택한 대상자 정보는 지도 위 말풍선이 아니라 왼쪽 패널에 둔다", () => {
    const html = renderToStaticMarkup(
      <AdminMap
        mapKey=""
        buildings={[
          {
            buildingId: "building-1",
            address: "대구광역시 서구 비산동 1",
            lat: 35.87,
            lng: 128.56,
            grade: 1,
            score: 31.5,
            statusCategory: "unchecked",
            openCount: 1,
            subjects: [
              {
                subjectId: "subject-1",
                name: "김○○",
                phone: "010-0000-0101",
                birthYear: 1938,
                workerId: "worker-1",
                workerName: "이담당",
                workerPhone: "010-0000-0001",
                buildingId: "building-1",
                address: "대구광역시 서구 비산동 1",
                lat: 35.87,
                lng: 128.56,
                grade: 1,
                score: 31.5,
                reasons: ["1938년생 (88세)·독거"],
                status: "UNCHECKED",
                statusLabel: "미확인",
                open: true,
              },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain('aria-label="선택한 대상자"');
    expect(html).toContain("김○○");
    expect(html).toContain("1938년생 (88세)·독거");
    expect(html.indexOf('aria-label="선택한 대상자"')).toBeLessThan(
      html.indexOf('aria-label="건물 위험도 지도"'),
    );
    expect(html).not.toContain("mapDetailPin");
  });

  it("유효하지 않은 좌표는 지도 오류로 분리한다", () => {
    const html = renderToStaticMarkup(
      <AdminMap
        mapKey="test-key"
        buildings={[
          {
            buildingId: "building-1",
            address: "대구광역시 서구 비산동 1",
            lat: Number.NaN,
            lng: 128.56,
            grade: 1,
            score: 31.5,
            statusCategory: "unchecked",
            openCount: 1,
            subjects: [],
          },
        ]}
      />,
    );

    expect(html).toContain("지도에 표시할 수 있는 건물 좌표가 없습니다");
  });

  it("위도·경도 범위를 벗어난 유한 좌표도 지도에서 제외한다", () => {
    expect(isValidMapCoordinate(90, 180)).toBe(true);
    expect(isValidMapCoordinate(90.01, 128.56)).toBe(false);
    expect(isValidMapCoordinate(35.87, 180.01)).toBe(false);
  });

  it("내용이 같은 새 건물 배열은 같은 지도 초기화 서명을 만든다", () => {
    const buildings = [
      {
        buildingId: "building-1",
        address: "대구광역시 서구 비산동 1",
        lat: 35.87,
        lng: 128.56,
        grade: 1 as const,
        score: 31.5,
        statusCategory: "unchecked" as const,
        openCount: 1,
        subjects: [
          {
            subjectId: "subject-1",
            name: "김○○",
            phone: "010-0000-0101",
            birthYear: 1938,
            workerId: "worker-1",
            workerName: "이담당",
            workerPhone: "010-0000-0001",
            buildingId: "building-1",
            address: "대구광역시 서구 비산동 1",
            lat: 35.87,
            lng: 128.56,
            grade: 1 as const,
            score: 31.5,
            reasons: ["1938년생 (88세)·독거"],
            status: "UNCHECKED" as const,
            statusLabel: "미확인",
            open: true,
          },
        ],
      },
    ];
    const refreshedBuildings = JSON.parse(JSON.stringify(buildings));

    expect(adminMapBuildingsSignature(refreshedBuildings)).toBe(
      adminMapBuildingsSignature(buildings),
    );
  });

  it("지도 초기화 서명을 다시 읽어도 건물 좌표를 유지한다", () => {
    const signature = adminMapBuildingsSignature([
      {
        buildingId: "building-1",
        address: "대구광역시 서구 비산동 1",
        lat: 35.87,
        lng: 128.56,
        grade: 1,
        score: 31.5,
        statusCategory: "unchecked",
        openCount: 1,
        subjects: [],
      },
    ]);
    const [building] = JSON.parse(signature) as Array<Record<string, unknown>>;

    expect(building).toMatchObject({ lat: 35.87, lng: 128.56 });
  });

  it("카카오 SDK에 마커 군집 라이브러리를 함께 요청한다", async () => {
    const { document, scripts } = createScriptDocument();
    vi.stubGlobal("document", document);
    vi.stubGlobal("window", {});

    const loading = loadKakaoSdk("test-key");
    const source = scripts[0].src;
    scripts[0].dispatch("error");
    await loading.catch(() => undefined);

    expect(source).toContain("libraries=clusterer");
  });

  it("군집 계산용 마커가 단일 건물 오버레이 클릭을 가로채지 않는다", () => {
    const source = readFileSync(new URL("./AdminMap.tsx", import.meta.url), "utf8");

    expect(source).toContain("clickable: false,");
    expect(source).toMatch(
      /new maps\.CustomOverlay\(\{[\s\S]*?clickable: true,[\s\S]*?content: button/,
    );
  });

  it("군집 초기화 도중 실패해도 addMarkers 전에 정리 함수를 등록한다", () => {
    const source = readFileSync(new URL("./AdminMap.tsx", import.meta.url), "utf8");

    expect(source.indexOf("cleanupClusterer = () => {")).toBeGreaterThan(-1);
    expect(source.indexOf("cleanupClusterer = () => {")).toBeLessThan(
      source.indexOf("clusterer.addMarkers(markers)"),
    );
  });

  it("실패한 SDK 스크립트를 제거해 다음 로드를 다시 시도한다", async () => {
    const { document, scripts } = createScriptDocument();
    vi.stubGlobal("document", document);
    vi.stubGlobal("window", {});

    const firstLoad = loadKakaoSdk("test-key");
    scripts[0].dispatch("error");

    await expect(firstLoad).rejects.toThrow("카카오 지도 SDK를 불러올 수 없습니다");
    expect(scripts[0].removed).toBe(true);

    const retryLoad = loadKakaoSdk("test-key");
    expect(scripts).toHaveLength(2);
    scripts[1].dispatch("error");
    await expect(retryLoad).rejects.toThrow("카카오 지도 SDK를 불러올 수 없습니다");
  });

  it("초기화 오류 정리는 생성된 오버레이와 지도 컨테이너를 함께 비운다", () => {
    let detached = 0;
    let cleared = 0;
    const overlays = [
      {
        setMap(map: null) {
          expect(map).toBeNull();
          detached += 1;
        },
      },
    ];

    cleanupKakaoMap(overlays, {
      replaceChildren() {
        cleared += 1;
      },
    });

    expect(detached).toBe(1);
    expect(cleared).toBe(1);
    expect(overlays).toHaveLength(0);
  });
});
