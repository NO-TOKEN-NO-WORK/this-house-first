export interface KmaGrid {
  nx: number;
  ny: number;
}

/** 기상청 API허브 「동네예보 격자영역 정보」의 Lambert conformal conic 투영값. */
export function toKmaGrid(latitude: number, longitude: number): KmaGrid {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new RangeError("기상청 동네예보 지원 지역이 아닙니다.");
  }
  const degrees = Math.PI / 180;
  const earthRadius = 6371.00877 / 5;
  const standardLatitude1 = 30 * degrees;
  const standardLatitude2 = 60 * degrees;
  const referenceLongitude = 126 * degrees;
  const referenceLatitude = 38 * degrees;

  let cone =
    Math.tan(Math.PI / 4 + standardLatitude2 / 2) /
    Math.tan(Math.PI / 4 + standardLatitude1 / 2);
  cone =
    Math.log(Math.cos(standardLatitude1) / Math.cos(standardLatitude2)) /
    Math.log(cone);
  const scale =
    (Math.pow(Math.tan(Math.PI / 4 + standardLatitude1 / 2), cone) *
      Math.cos(standardLatitude1)) /
    cone;
  const referenceRadius =
    (earthRadius * scale) /
    Math.pow(Math.tan(Math.PI / 4 + referenceLatitude / 2), cone);
  const radius =
    (earthRadius * scale) /
    Math.pow(Math.tan(Math.PI / 4 + latitude * degrees / 2), cone);
  let theta = longitude * degrees - referenceLongitude;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= cone;

  const grid = {
    nx: Math.floor(radius * Math.sin(theta) + 43.5),
    ny: Math.floor(referenceRadius - radius * Math.cos(theta) + 136.5),
  };
  if (grid.nx < 1 || grid.nx > 149 || grid.ny < 1 || grid.ny > 253) {
    throw new RangeError("기상청 동네예보 지원 지역이 아닙니다.");
  }
  return grid;
}
