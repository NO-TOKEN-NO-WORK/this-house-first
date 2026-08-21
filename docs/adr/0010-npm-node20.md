# ADR-0010: 패키지 매니저는 npm, 런타임은 Node 20을 쓴다

- **상태**: 승인됨
- **날짜**: 2026-08-22
- **결정자**: 팀 전원

## 맥락 (Context)

팀원 여러 명 + AI 에이전트가 같은 리포에서 작업한다. lockfile이 갈리면(예: 누구는 pnpm, 누구는 npm) 머지 충돌과 "내 컴퓨터에선 되는데"가 발생한다. CI도 하나의 도구로 고정되어야 한다.

## 결정 (Decision)

- 패키지 매니저: **npm** (lockfile은 `package-lock.json` 하나만 커밋)
- 런타임: **Node.js 20 LTS** (`package.json`의 `engines`로 명시, CI도 20 고정)
- 다른 패키지 매니저의 lockfile(`pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`)은 커밋 금지

## 근거 (Rationale)

- npm은 모든 팀원 환경에 이미 존재 — 설치 안내가 필요 없는 유일한 선택
- Node 20은 현 시점 팀 로컬 환경과 일치하며 Next.js 16 지원 범위

## 검토한 대안 (Alternatives)

- **pnpm** — 빠르고 디스크 효율적이나 전원 설치 필요, 해커톤에서 이득 미미. 기각
- **bun** — 속도 매력적이나 Next.js·Prisma 호환성 리스크를 안을 이유 없음. 기각

## 결과 (Consequences)

- 긍정: 온보딩 명령이 `npm install` 하나, CI 캐싱 단순
- 부정/트레이드오프: 설치 속도는 pnpm보다 느림 — 감수
- 되돌리기: lockfile 교체 커밋 한 번이지만, 48h 내에는 변경 금지
