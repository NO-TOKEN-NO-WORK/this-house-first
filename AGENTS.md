# AGENTS.md — 이 집 먼저 (This House First)

> 이 파일이 AI 에이전트 지침의 **원본**이다. `CLAUDE.md`는 이 파일의 심링크이므로 Claude Code·Codex·Cursor 등 어떤 도구든 동일한 내용을 읽는다. 지침 수정은 반드시 이 파일에서만 한다.

## 프로젝트 한 줄

폭염·한파 경보일에 "오늘 누가 위험한지, 누구부터 확인할지, 언제 방문으로 전환할지"를 정해주는 취약노인 관제 시스템. JunctionX Korea 2026 48h 해커톤 MVP (PWA).

## 작업 전 필독 문서

| 문서 | 내용 |
|---|---|
| [docs/PRD.md](docs/PRD.md) | 제품 요구사항 — 기능(FR-1~11)·플로우(F1~F5)·비목표의 원본 |
| [docs/architecture.md](docs/architecture.md) | 시스템 구성·데이터 모델·상태머신·라우트 계획 스냅샷 |
| [docs/adr/](docs/adr/README.md) | 기술 결정 기록. **새 기술 스택 도입·교체는 ADR 없이 금지** |

## 명령어

```bash
npm run dev          # 개발 서버 (http://localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
npm test             # Vitest (스코어링·상태머신 단위 테스트)
npx prisma db push   # 스키마 → 로컬 SQLite (dev.db) 반영
npm run db:seed      # 시드 — 건축HUB·카카오 실호출로 건물 10동 + 합성 대상자 15명 (키 필요, ADR-0012)
npx prisma studio    # DB 브라우저
```

최초 세팅: `npm install` → `cp .env.example .env`(키 입력) → `npx prisma db push` → `npm run db:seed`

## 기술 스택 (근거는 각 ADR)

Next.js 16 App Router 모놀리스([ADR-0001](docs/adr/0001-nextjs-fullstack-monolith.md)) · TypeScript strict([0002](docs/adr/0002-typescript-strict.md)) · Tailwind 4([0003](docs/adr/0003-tailwind-css.md)) · SQLite+Prisma([0004](docs/adr/0004-sqlite-prisma.md)) · 규칙 기반 스코어링([0005](docs/adr/0005-rule-based-risk-model.md)) · 수제 SW PWA([0006](docs/adr/0006-pwa-manual-service-worker.md)) · 카카오맵([0007](docs/adr/0007-kakao-map.md)) · 인앱 알림([0008](docs/adr/0008-notification-in-app-first.md)) · Vitest([0009](docs/adr/0009-vitest.md)) · npm+Node20([0010](docs/adr/0010-npm-node20.md)) · 로컬 데모 우선([0011](docs/adr/0011-deploy-local-demo-first.md)) · 시드 tsx+건축HUB 실호출([0012](docs/adr/0012-seed-runner-tsx.md))

## 도메인 규칙 (어기면 리뷰 반려)

1. **가중치는 `src/lib/scoring/weights.ts`에서만** 정의·수정한다. 모든 가중치·임계값에는 **출처 주석 필수** (PRD §7 — "가중치 어떻게 정했나" 방어가 스펙이다). 출처 없는 잠정치는 `잠정` 주석을 명시
2. **상태값 문자열 하드코딩 금지.** 경보 단계·가구 상태·확인 결과 코드는 `src/lib/domain.ts`의 `as const` 상수만 사용 (SQLite에 enum이 없어 타입이 유일한 방어선)
3. **설명 가능성**: 사용자에게 보이는 모든 위험 판단은 스코어링 엔진이 반환한 `reasons`를 그대로 표시한다. UI에서 위험 사유를 재작성하지 않는다
4. **알림 침묵 원칙**: 비경보일에는 어떤 알림도 만들지 않는다. 경보일에도 요약 1건 + 승격 이벤트만 (PRD §9)
5. **담당자(`/today`) UI 원칙**: 60대 사용자 기준 — 큰 글자, 화면당 결정 1개, 어떤 기록도 탭 2회 이내 완료 (PRD §9). 관리자 화면에는 이 제약이 없다
6. 스코어링·상태머신은 **순수 함수**로 유지하고, 수정 시 `*.test.ts`를 함께 갱신한다

## 금지 사항 (PRD 비목표 §3)

- **실명·실인물 개인정보 데이터 절대 금지.** 대상자는 합성 데이터만. 원칙: "건물은 진짜(실제 건축물대장), 사람은 가짜"
- 대상자(어르신)용 화면·앱을 만들지 않는다. 사용자는 담당자와 관리자뿐
- IoT·센서·AI 음성 자동전화 통합을 시도하지 않는다
- 서버 전용 API 키(`PUBLIC_DATA_SERVICE_KEY` 등)를 클라이언트 코드나 `NEXT_PUBLIC_*`으로 노출하지 않는다
- 새 라이브러리·프레임워크·저장소 도입을 ADR 없이 하지 않는다 ([docs/adr/README.md](docs/adr/README.md)의 규칙)

## 코드 컨벤션

- 도메인 개념 주석·UI 문자열은 한국어, 식별자는 영어
- 서버 전용 로직은 `src/lib/`, 화면은 `src/app/`, 재사용 UI는 `src/components/`
- 외부 API 호출은 Route Handler(`src/app/api/`)를 거친다 — 클라이언트에서 공공 API 직접 호출 금지
- 용어 통일: 담당자(생활지원사) / 관리자 / 대상자 / 경보 단계(주의·경보·비상) / 등급(1·2·3) / 승격(방문 큐로)

## Git / 협업

- 브랜치: `main` 직접 푸시 금지. `feat/…`, `fix/…`, `docs/…` 브랜치 → PR → CI(lint·test·build) 통과 → 머지
- 커밋: Conventional Commits 경량형 (`feat:`, `fix:`, `docs:`, `chore:`, `test:`)
- PR 템플릿의 체크리스트(도메인 규칙 준수 여부)를 채운다
- lockfile은 `package-lock.json`만 커밋 (ADR-0010)
