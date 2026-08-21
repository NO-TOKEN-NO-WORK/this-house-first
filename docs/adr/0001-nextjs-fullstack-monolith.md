# ADR-0001: 풀스택 프레임워크로 Next.js 16 (App Router) 모놀리스를 쓴다

- **상태**: 승인됨
- **날짜**: 2026-08-22
- **결정자**: 팀 전원

## 맥락 (Context)

48시간 안에 두 개의 화면(담당자 모바일 웹 FR-4, 관리자 지도 대시보드 FR-6)과 서버 로직(기상 트리거 FR-1, 스코어링 FR-3, 에스컬레이션 FR-5, 외부 API 프록시)을 모두 만들어야 한다. 프론트/백엔드를 분리하면 배포 2벌, CORS, 타입 공유 문제로 시간이 샌다. 산출물은 PWA여야 한다.

## 결정 (Decision)

**Next.js 16 (App Router, TypeScript) 단일 애플리케이션**으로 프론트엔드와 백엔드(Route Handlers)를 함께 구현한다. 담당자 화면과 관리자 화면은 같은 앱의 라우트(`/today`, `/admin`)로 나눈다.

## 근거 (Rationale)

- 서버 코드와 UI가 한 리포·한 배포 단위 — 48h 해커톤에서 인프라 작업 최소화
- Route Handlers로 외부 공공 API(기상청·건축HUB) 키를 서버 측에 숨긴 채 프록시 가능
- React Server Components로 대시보드 데이터 로딩 코드 단순화
- 팀·AI 에이전트 모두에게 가장 문서·사례가 풍부한 스택

## 검토한 대안 (Alternatives)

- **Vite + React SPA + 별도 Express 서버** — 배포 2벌, CORS, 타입 공유 설정에 시간 소모. 기각
- **Remix / SvelteKit** — 역량 대비 이점 없음, 팀 친숙도 낮음. 기각
- **네이티브/React Native 앱** — PRD 비목표(§3), 웹 PWA로 충분. 기각

## 결과 (Consequences)

- 긍정: 하나의 dev 서버, 하나의 빌드, 타입 공유가 공짜
- 부정/트레이드오프: "매일 17시 폴링" 같은 cron은 프레임워크가 제공하지 않음 → 데모는 수동 트리거로 대체([ADR-0011](0011-deploy-local-demo-first.md)). Next 16은 빌드가 Turbopack 기본이라 webpack 플러그인 생태계 일부와 비호환([ADR-0006](0006-pwa-manual-service-worker.md) 참고)
- 되돌리기: 사실상 전면 재작성. 초기에 확정하고 유지한다
