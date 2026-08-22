import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AdminMap,
  adminMapBuildingsSignature,
  cleanupKakaoMap,
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
            workerId: "worker-1",
            workerName: "이담당",
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
