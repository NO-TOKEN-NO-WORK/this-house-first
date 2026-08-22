# ADR (Architecture Decision Records)

이 프로젝트의 **모든 기술 스택·아키텍처 결정은 ADR로 기록한다.** 결정의 원본(single source of truth)은 이 디렉터리이며, [docs/architecture.md](../architecture.md)는 결정들의 현재 상태를 요약한 스냅샷이다.

## 규칙

1. 새 라이브러리·프레임워크·인프라·데이터 저장 방식을 도입/교체/제거하는 PR에는 **ADR이 반드시 동반**되어야 한다.
2. [0000-adr-template.md](0000-adr-template.md)를 복사해 다음 번호로 작성한다. 파일명: `NNNN-kebab-case-제목.md`
3. 결정을 뒤집을 때는 기존 ADR을 수정하지 않는다. 새 ADR을 쓰고, 기존 ADR의 상태를 `대체됨(ADR-NNNN)`으로 바꾼다.
4. ADR은 짧게. 맥락 → 결정 → 근거 → 대안 → 결과. 한 페이지를 넘기지 않는다.

## 인덱스

| ADR | 제목 | 상태 |
|---|---|---|
| [0001](0001-nextjs-fullstack-monolith.md) | 풀스택 프레임워크: Next.js 16 App Router 모놀리스 | 승인됨 |
| [0002](0002-typescript-strict.md) | 언어: TypeScript (strict) | 승인됨 |
| [0003](0003-tailwind-css.md) | 스타일링: Tailwind CSS 4 | 승인됨 |
| [0004](0004-sqlite-prisma.md) | 데이터베이스/ORM: SQLite + Prisma | 대체됨([0013](0013-prisma-postgres.md)) |
| [0005](0005-rule-based-risk-model.md) | 위험도 모델: 규칙 기반 (ML 배제) | 승인됨 |
| [0006](0006-pwa-manual-service-worker.md) | PWA: Manifest + 수제 Service Worker | 부분 대체됨([0017](0017-notification-events-web-push.md)) |
| [0007](0007-kakao-map.md) | 지도: 카카오맵 JS SDK | 부분 대체됨([0018](0018-kakao-driving-shortest-route.md)) |
| [0008](0008-notification-in-app-first.md) | 알림 전달: v0 인앱, Web Push는 스트레치 | 대체됨([0017](0017-notification-events-web-push.md)) |
| [0009](0009-vitest.md) | 테스트: Vitest (핵심 로직 단위 테스트) | 승인됨 |
| [0010](0010-npm-node20.md) | 패키지 매니저/런타임: npm + Node 20 | 승인됨 |
| [0011](0011-deploy-local-demo-first.md) | 배포/데모 전략: 로컬 데모 우선, 수동 트리거 | 승인됨 |
| [0012](0012-seed-runner-tsx.md) | 시드: tsx 실행기 + 건축HUB 실호출로 건물 데이터 생성 | 승인됨 |
| [0013](0013-prisma-postgres.md) | DB: Prisma Postgres 전환 + Vercel 배포 | 승인됨 |
| [0014](0014-figma-design-with-domain-terms.md) | 담당자 화면: Figma 디자인 + 도메인 상수 문구 | 부분 대체됨([0016](0016-alert-level-labels-advisory-watch-severe.md), [0019](0019-emergency-only-alert-banner.md)) |
| [0015](0015-design-system-tokens.md) | 디자인 시스템: Figma Foundations → Primitive/Semantic 2층 토큰 | 승인됨 |
| [0016](0016-alert-level-labels-advisory-watch-severe.md) | 경보 단계 화면 문구: 주의/경계/심각 (코드는 ADVISORY/WARNING/EMERGENCY) | 부분 대체됨([0019](0019-emergency-only-alert-banner.md)) |
| [0017](0017-notification-events-web-push.md) | 알림: 이벤트 원장 + Web Push 전달 | 승인됨 |
| [0018](0018-kakao-driving-shortest-route.md) | 방문 동선: 카카오 자동차 최단 경로 | 승인됨 |
| [0019](0019-emergency-only-alert-banner.md) | 경보 배너는 비상 단계에만 · 최고 단계 문구 `비상` | 승인됨 |
| [0020](0020-welfare-scan-luna-responses.md) | 복지 스캔: Luna 신호 추출 + 규칙 기반 자격 판정 | 부분 대체됨([0023](0023-vercel-ai-gateway-luna.md)) |
| [0021](0021-visit-record-flow.md) | 방문 기록 흐름: 고르고 한 번 저장 · 끝난 방문은 되읽기 | 승인됨 |
| [0022](0022-permanent-roster-alert-snapshot-separation.md) | 상시 원장과 경보 스냅샷 분리 | 승인됨 |
| [0023](0023-vercel-ai-gateway-luna.md) | 복지 스캔 Luna 호출을 Vercel AI Gateway로 전환 | 승인됨 |
