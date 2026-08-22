# AGENTS.md — See:Near

> 이 파일이 AI 에이전트 지침의 **원본**이다. `CLAUDE.md`는 이 파일의 심링크이므로 Claude Code·Codex·Cursor 등 어떤 도구든 동일한 내용을 읽는다. 지침 수정은 반드시 이 파일에서만 한다.

## 프로젝트 한 줄

폭염·한파 경보일에 "오늘 누가 위험한지, 누구부터 확인할지, 언제 방문으로 전환할지"를 정해주는 취약노인 관제 시스템. JunctionX Korea 2026 48h 해커톤 MVP (PWA).

## 작업 전 필독 문서

| 문서 | 내용 |
|---|---|
| [docs/PRD.md](docs/PRD.md) | 제품 요구사항 — 기능(FR-1~12)·플로우(F1~F6)·비목표의 원본 |
| [docs/architecture.md](docs/architecture.md) | 시스템 구성·데이터 모델·상태머신·라우트 계획 스냅샷 |
| [docs/adr/](docs/adr/README.md) | 기술 결정 기록. **새 기술 스택 도입·교체는 ADR 없이 금지** |

## 명령어

```bash
npm run dev          # 개발 서버 (http://localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
npm test             # Vitest (스코어링·상태머신 단위 테스트)
npm run db:migrate   # 스키마 변경 → 마이그레이션 생성·적용 (Prisma Postgres, ADR-0013)
npm run db:deploy    # 기존 마이그레이션만 적용 (배포·팀원 세팅)
npm run db:seed      # 시드 — 건축HUB·카카오 실호출로 건물 10동 + 합성 대상자 15명 (키 필요, ADR-0012)
npm run push:keys    # Web Push VAPID 공개키·비밀키 생성 (ADR-0017)
npx prisma studio    # DB 브라우저
```

최초 세팅: `npm install` → `cp .env.example .env` → DB 발급(`npx create-db@latest`, pooled URL은 `DATABASE_URL`, direct URL은 `DIRECT_URL`에 입력) + API 키 입력 → `npm run db:deploy` → `npm run db:seed`

> `create-db`로 받은 DB는 24시간 뒤 삭제된다. 계속 쓰려면 출력된 claim URL로 클레임한다 (ADR-0013).

## 기술 스택 (근거는 각 ADR)

Next.js 16 App Router 모놀리스([ADR-0001](docs/adr/0001-nextjs-fullstack-monolith.md)) · TypeScript strict([0002](docs/adr/0002-typescript-strict.md)) · Tailwind 4([0003](docs/adr/0003-tailwind-css.md)) · Prisma Postgres([0013](docs/adr/0013-prisma-postgres.md), [0004](docs/adr/0004-sqlite-prisma.md) 대체) · 규칙 기반 스코어링([0005](docs/adr/0005-rule-based-risk-model.md)) · 수제 SW PWA([0006](docs/adr/0006-pwa-manual-service-worker.md)) · 카카오맵([0007](docs/adr/0007-kakao-map.md)) · 알림 이벤트+Web Push([0017](docs/adr/0017-notification-events-web-push.md), [0008](docs/adr/0008-notification-in-app-first.md) 대체) · Vitest([0009](docs/adr/0009-vitest.md)) · npm+Node20([0010](docs/adr/0010-npm-node20.md)) · 로컬 데모 우선([0011](docs/adr/0011-deploy-local-demo-first.md)) · 시드 tsx+건축HUB 실호출([0012](docs/adr/0012-seed-runner-tsx.md)) · Prisma Postgres+Vercel([0013](docs/adr/0013-prisma-postgres.md)) · Figma 2층 디자인 토큰([0015](docs/adr/0015-design-system-tokens.md)) · AI는 Vercel AI Gateway 경유·근거 인용 강제([0020](docs/adr/0020-welfare-scan-luna-responses.md), [0023](docs/adr/0023-vercel-ai-gateway-luna.md), [0024](docs/adr/0024-subject-context-briefing.md))

## 도메인 규칙 (어기면 리뷰 반려)

1. **가중치는 `src/lib/scoring/weights.ts`에서만** 정의·수정한다. 모든 가중치·임계값에는 **출처 주석 필수** (PRD §7 — "가중치 어떻게 정했나" 방어가 스펙이다). 출처 없는 잠정치는 `잠정` 주석을 명시
2. **상태값 문자열 하드코딩 금지.** 경보 단계·가구 상태·확인 결과 코드는 `src/lib/domain.ts`의 `as const` 상수만 사용 (DB 컬럼이 String이라 도메인 상수·가드가 유일한 방어선 — ADR-0013)
3. **설명 가능성**: 사용자에게 보이는 모든 위험 판단은 스코어링 엔진이 반환한 `reasons`를 그대로 표시한다. UI에서 위험 사유를 재작성하지 않는다
4. **알림 침묵 원칙**: 비경보일에는 어떤 알림도 만들지 않는다. 경보일에도 요약 1건 + 승격 이벤트만 (PRD §9)
5. **담당자(`/today`) UI 원칙**: 60대 사용자 기준 — 큰 글자, 화면당 결정 1개, 어떤 기록도 탭 2회 이내 완료 (PRD §9). 관리자 화면에는 이 제약이 없다. 화면 디자인은 Figma `junction`을 따르되 **문구는 `domain.ts` 상수**를 쓴다 — 의도적으로 다른 지점 목록은 [ADR-0014](docs/adr/0014-figma-design-with-domain-terms.md)·[ADR-0021](docs/adr/0021-visit-record-flow.md)
6. **담당자·공용 Tailwind 화면의 색·글자는 Semantic 토큰만 쓴다** (ADR-0015). `src/app/globals.css`의 2층 구조에서 화면이 쓸 수 있는 것은 2층뿐이다 — `text-text-primary`·`bg-status-critical`·`text-label-15`처럼 Figma 스와치에 적힌 이름을 그대로 쓴다. 1층 원시 색(`--neutral-500` 등)은 유틸리티가 없고, Tailwind 기본 팔레트(`bg-white`·`text-zinc-500`)는 지워져 있다. 임의값(`text-[15px]`, `bg-[#fff]`)도 금지 — 필요한 값이 없으면 Figma 변수를 먼저 확인하고, 없으면 `globals.css` 확장 묶음에 `잠정` 주석과 함께 추가한다. 관리자 CSS Module은 기존 `tokens.css`의 `--admin-*` 체계를 유지하되, 위험 단계 색은 전역 Semantic 토큰을 참조한다
7. 스코어링·상태머신은 **순수 함수**로 유지하고, 수정 시 `*.test.ts`를 함께 갱신한다
8. **AI 산출물은 위험도에 닿지 않고, 근거 없이는 화면에 나가지 않는다** (ADR-0024). 세 가지가 전부 지켜져야 한다 — ① 모델 출력을 `RiskAssessment`의 `score`·`grade`·`reasons`에 쓰지 않는다(점수·순서는 규칙 엔진 단독, ADR-0005) ② 모델이 낸 문장은 실재하는 `CheckEvent` id를 근거로 달아야 하고, 서버가 그 행이 **해당 대상자의 것인지** 대조해 통과 못하면 버린다 ③ 화면의 근거 문구는 모델 출력이 아니라 DB 행에서 만든다. 외부 모델에 보내는 자유 서술은 서버에서 이름·전화·주소·기관명을 지운 뒤 **대상자 1명분씩**만 보내고 `store: false`를 유지한다

## 금지 사항 (PRD 비목표 §3)

- **실명·실인물 개인정보 데이터 절대 금지.** 대상자는 합성 데이터만. 원칙: "건물은 진짜(실제 건축물대장), 사람은 가짜"
- 대상자(어르신)용 화면·앱을 만들지 않는다. 사용자는 담당자와 관리자뿐
- IoT·센서·AI 음성 자동전화 통합을 시도하지 않는다
- 서버 전용 API 키(`PUBLIC_DATA_SERVICE_KEY` 등)를 클라이언트 코드나 `NEXT_PUBLIC_*`으로 노출하지 않는다
- 새 라이브러리·프레임워크·저장소 도입을 ADR 없이 하지 않는다 ([docs/adr/README.md](docs/adr/README.md)의 규칙)
- AI가 위험 점수·확인 순서·복지 수급 자격을 결정하게 하지 않는다 — 셋 다 규칙 엔진의 몫이다 (PRD §3 비목표)
- 담당자·대상자 자유 서술을 마스킹·별칭 처리 없이 외부 모델에 보내지 않는다 (ADR-0024)

## 코드 컨벤션

- 도메인 개념 주석·UI 문자열은 한국어, 식별자는 영어
- 서버 전용 로직은 `src/lib/`, 화면은 `src/app/`, 재사용 UI는 `src/components/`
- 외부 API 호출은 Route Handler(`src/app/api/`)를 거친다 — 클라이언트에서 공공 API 직접 호출 금지
- 용어 통일: 담당자(생활지원사) / 관리자 / 대상자 / 경보 단계(주의·경계·비상) / 위험 단계(심각·경계·주의) / 승격(방문 큐로) / 맥락 브리핑(FR-12 — `요약`·`AI 분석`이라 부르지 않는다)

## Git / 협업

- 브랜치: `main` 직접 푸시 금지. `feat/…`, `fix/…`, `docs/…` 브랜치 → PR → CI(lint·test·build) 통과 → 머지
- 커밋: Conventional Commits 경량형 (`feat:`, `fix:`, `docs:`, `chore:`, `test:`)
- PR 템플릿의 체크리스트(도메인 규칙 준수 여부)를 채운다
- lockfile은 `package-lock.json`만 커밋 (ADR-0010)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
