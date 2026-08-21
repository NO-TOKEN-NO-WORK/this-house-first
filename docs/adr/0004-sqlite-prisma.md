# ADR-0004: 데이터베이스는 SQLite, ORM은 Prisma를 쓴다

- **상태**: 대체됨([ADR-0013](0013-prisma-postgres.md)) — datasource는 Prisma Postgres로 교체. ORM(Prisma) 결정은 유효하다
- **날짜**: 2026-08-22
- **결정자**: 팀 전원

## 맥락 (Context)

데이터 규모는 합성 대상자 15명 + 경보일별 평가/기록(PRD §8). 데모는 로컬 실행이 기본([ADR-0011](0011-deploy-local-demo-first.md))이고, 팀원 각자가 DB 세팅 없이 `npm install` 직후 개발을 시작할 수 있어야 한다. 관계형 모델(대상자–건물–담당자–경보일–기록)이 명확하다.

## 결정 (Decision)

**SQLite(파일 DB) + Prisma ORM 7.** 스키마는 `prisma/schema.prisma`가 단일 원본. 로컬 DB 파일(`dev.db`)은 커밋하지 않고 `npx prisma db push`로 각자 생성한다.

Prisma 7 구성 (v6과 다른 점 — 팀 주의):

- 설정은 `prisma.config.ts` (`.env` 로딩은 dotenv 명시 import, DATABASE_URL도 여기서 주입)
- 클라이언트는 `prisma-client` generator가 `src/generated/prisma/`에 TS 코드로 생성 (커밋·린트 제외, `postinstall`에서 자동 생성)
- 런타임은 driver adapter 필수 — `@prisma/adapter-better-sqlite3`. DB 접근은 항상 `src/lib/db.ts`의 싱글턴을 통한다
- `prisma init`이 설치한 Prisma 공식 AI 스킬(`.agents/skills/`, `.claude/`·`.windsurf/`는 심링크)은 커밋해 팀·에이전트가 공유한다

## 근거 (Rationale)

- 설치·서버·계정이 전혀 필요 없음 — 협업 온보딩 비용 0
- Prisma 스키마가 곧 데이터 모델 문서 — 마이그레이션·타입 생성 자동
- 규모(수백 행)에서 성능 논점 자체가 없음

## 검토한 대안 (Alternatives)

- **Postgres (Supabase/Neon)** — 클라우드 배포엔 유리하나 계정·네트워크 의존이 데모 리스크. 필요 시 provider 교체로 이전 가능하므로 지금은 기각
- **JSON 파일/인메모리** — 관계·동시 기록(담당자 여러 명)에 취약, 재시작 시 유실. 기각

## 결과 (Consequences)

- 긍정: 세팅 제로, 데모 중 네트워크 무관
- 부정/트레이드오프: **Prisma는 SQLite에서 `enum`·`Json` 타입을 지원하지 않음** → 상태값은 `String` 컬럼 + `src/lib/domain.ts`의 `as const` 상수로 강제([ADR-0002](0002-typescript-strict.md)), 위험 사유(reasons)는 JSON 직렬화 문자열로 저장
- 되돌리기: `datasource` provider를 postgresql로 바꾸고 `db push` — 모델 코드는 거의 무수정
