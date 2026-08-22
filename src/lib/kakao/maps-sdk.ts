/** 카카오맵 JavaScript SDK에서 앱이 실제 사용하는 최소 타입 표면. */
export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoLatLngBounds {
  extend(position: KakaoLatLng): void;
}

export interface KakaoMapInstance {
  setBounds(bounds: KakaoLatLngBounds): void;
  setLevel(level: number): void;
}

export interface KakaoOverlay {
  setMap(map: KakaoMapInstance | null): void;
}

export type KakaoCircle = KakaoOverlay;

export interface KakaoMaps {
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
  Polyline: new (options: {
    map: KakaoMapInstance;
    path: KakaoLatLng[];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeStyle: "solid";
  }) => KakaoOverlay;
  CustomOverlay: new (options: {
    map: KakaoMapInstance;
    position: KakaoLatLng;
    content: HTMLElement;
    xAnchor: number;
    yAnchor: number;
    zIndex: number;
  }) => KakaoOverlay;
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
