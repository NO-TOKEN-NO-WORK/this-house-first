# ADR-0006: PWA는 Manifest + 수제 Service Worker로 구성한다

- **상태**: 승인됨
- **날짜**: 2026-08-22
- **결정자**: 팀 전원

## 맥락 (Context)

산출물은 PWA다: 담당자가 홈 화면에 설치해 앱처럼 쓰는 모바일 웹(FR-4). 오프라인 내성은 PRD §9에서 "데모에선 언급만" 수준이다. Next.js 16은 빌드가 Turbopack 기본이라, webpack 플러그인에 의존하는 PWA 라이브러리(@serwist/next, next-pwa)는 호환 리스크가 있다.

## 결정 (Decision)

- **Web App Manifest**: Next.js Metadata Route(`src/app/manifest.ts`)로 제공 — 설치 가능성(installability) 확보
- **Service Worker**: `public/sw.js`에 직접 작성한 최소 워커 (페이지는 network-first + 캐시 폴백, 정적 자원은 cache-first). 등록은 `ServiceWorkerRegistrar` 클라이언트 컴포넌트에서 production에서만 수행
- 오프라인 기록 큐잉(PRD §9)은 구현하지 않고 데모 멘트로만 다룬다

## 근거 (Rationale)

- 빌드 체인과 완전 분리 — Turbopack/Next 버전과 무관하게 항상 동작
- 설치 가능 + 기본 오프라인 폴백이면 v0 PWA 요구를 100% 충족
- 수십 줄짜리 워커는 디버깅 가능, 라이브러리 블랙박스는 해커톤에서 시한폭탄

## 검토한 대안 (Alternatives)

- **@serwist/next** — 정교한 precache 제공하나 Turbopack 빌드와 비호환 리스크. v0 요구 대비 과함. 기각
- **next-pwa** — 유지보수 중단 상태. 기각

## 결과 (Consequences)

- 긍정: 빌드 안정성, 완전한 제어
- 부정/트레이드오프: 빌드 산출물 자동 precache 없음 — v0에선 불필요. 캐시 무효화는 `sw.js`의 캐시 버전 상수를 수동 갱신
- 되돌리기: 오프라인 큐잉이 실요구가 되면 Serwist 도입 ADR을 새로 쓴다
