# 이 집 먼저 (This House First)

**폭염·한파 위험도 기반 취약노인 알림·대응 관제 시스템** — JunctionX Korea 2026 (48h MVP)

폭염(한파) 경보일에 돌봄 대상 어르신 개개인의 위험도를 계산해, "오늘 누가 위험한지, 누구부터 확인할지, 언제 방문으로 전환할지"를 담당 생활지원사에게 정해주는 PWA. 평소에는 조용한 게 스펙입니다.

## 빠른 시작

```bash
npm install            # postinstall에서 prisma generate 자동 실행
cp .env.example .env   # API 키는 필요해지면 채운다 (로컬 개발은 빈 값으로 시작 가능)
npx prisma db push     # 로컬 SQLite(prisma/dev.db) 생성
npm run dev            # http://localhost:3000
```

요구 환경: Node.js 20+ / npm

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` · `npm start` | 프로덕션 빌드·실행 (데모 모드) |
| `npm run lint` | ESLint |
| `npm test` | Vitest — 스코어링·상태머신 단위 테스트 |
| `npm run db:push` | 스키마 변경을 로컬 DB에 반영 |
| `npm run db:studio` | DB 브라우저 |

## 문서

| 문서 | 내용 |
|---|---|
| [docs/PRD.md](docs/PRD.md) | 제품 요구사항 (기능·플로우·위험도 모델·데모 시나리오) |
| [docs/architecture.md](docs/architecture.md) | 아키텍처 스냅샷 (구성도·데이터 모델·상태머신) |
| [docs/adr/](docs/adr/README.md) | 기술 결정 기록 — **모든 스택 결정은 ADR 필수** |
| [AGENTS.md](AGENTS.md) | AI 에이전트·개발 규칙 (CLAUDE.md는 이 파일의 심링크) |

## 협업 규칙

- `main` 직접 푸시 금지 — `feat/…`, `fix/…`, `docs/…` 브랜치에서 PR
- PR은 CI(lint·test·build) 통과 후 머지, PR 템플릿 체크리스트 준수
- 커밋 메시지: `feat:`, `fix:`, `docs:`, `chore:`, `test:` 접두사
- 새 라이브러리·프레임워크 도입은 [ADR](docs/adr/README.md) 없이 금지
- **실명·실인물 개인정보 절대 금지** — 대상자는 합성 데이터만 ("건물은 진짜, 사람은 가짜")

> **Windows 참고**: `CLAUDE.md`와 `.claude/`, `.windsurf/`는 심링크입니다. 클론 전에 `git config --global core.symlinks true`와 Windows 개발자 모드 활성화가 필요합니다.

## 기술 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 7 + SQLite · Vitest · 카카오맵 — 각 선택의 근거는 [docs/adr/](docs/adr/README.md)
