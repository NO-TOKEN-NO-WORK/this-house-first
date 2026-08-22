import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminMap } from "./AdminMap";

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
});
