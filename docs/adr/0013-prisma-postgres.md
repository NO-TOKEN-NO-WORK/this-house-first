# ADR-0013: 데이터베이스를 Prisma Postgres로 옮기고 Vercel 배포를 연다

- **상태**: 승인됨
- **날짜**: 2026-08-22
- **결정자**: 팀 전원
- **관련**: [ADR-0004](0004-sqlite-prisma.md)(대체됨) · [ADR-0011](0011-deploy-local-demo-first.md)(유지, 조건부 판단을 여기서 확정)

## 맥락 (Context)

심사위원이 각자 접속해볼 공개 URL이 필요해졌다. [ADR-0011](0011-deploy-local-demo-first.md)은 이 상황을 예상해 "심사용 공개 URL이 필요해지면 Vercel + Postgres 전환을 D2에 판단"으로 남겨뒀고, 지금이 그 판단 시점이다.

SQLite 파일([ADR-0004](0004-sqlite-prisma.md))은 서버리스와 궁합이 나쁘다. Vercel 함수는 인스턴스마다 파일시스템이 분리되고 배포마다 초기화되므로, 담당자가 기록한 확인 결과가 다음 요청에서 사라진다. 저장소 교체가 배포의 선결 조건이다.

## 결정 (Decision)

**Prisma Postgres**(관리형)로 옮긴다. ORM은 [ADR-0004](0004-sqlite-prisma.md)에서 정한 Prisma를 그대로 쓴다 — 바뀌는 것은 datasource와 드라이버뿐이다.

- `provider = "postgresql"`, 런타임 어댑터는 **`@prisma/adapter-pg` + `pg`**. Vercel 함수는 Node 런타임이므로 엣지 전용 어댑터(`@prisma/adapter-ppg`)가 아니라 표준 경로를 쓴다
- 스키마 반영을 `prisma db push`에서 **마이그레이션 파일**(`prisma/migrations/`)로 바꾼다. 배포에서 `prisma migrate deploy`가 돌아야 스키마 드리프트 없이 재현된다
- Vercel 빌드는 `vercel-build` 스크립트(`prisma migrate deploy && next build`)를 쓴다. `build`는 그대로 둬서 CI(DB 없음)가 계속 통과한다
- 연결 문자열은 용도별로 분리한다. 런타임 `DATABASE_URL`은 풀러 엔드포인트(`pooled.db.prisma.io`), Prisma CLI의 `DIRECT_URL`은 direct 엔드포인트(`db.prisma.io`)다. 트랜잭션 모드 풀러는 마이그레이션에 필요한 세션 연속성을 보장하지 않는다
- 서버리스에서는 인스턴스마다 풀이 생기므로 인스턴스당 커넥션을 작게 잡는다(`max: 5`)

## 근거 (Rationale)

- **이미 Prisma 7 + driver adapter 구조다.** 교체 범위가 `datasource` 한 줄과 `src/lib/db.ts` 한 파일로 끝난다. 스코어링·상태머신·시드는 순수 함수라 손댈 것이 없다(실제로 코드 변경 없이 시드 결과가 동일했다)
- **계정 없이 즉시 DB를 띄울 수 있다.** `npx create-db@latest`가 몇 초 만에 연결 문자열과 claim URL을 준다. 48시간 안에 팀원 각자가 로컬 DB를 갖는 비용이 사실상 0이고, 이 전환 자체도 실제 DB에 마이그레이션·시드·API를 태워 검증했다
- **벤더가 하나 늘지 않는다.** Prisma Console에서 Studio·연결 문자열·사용량을 함께 본다. `prisma postgres link`로 기존 DB에 로컬 프로젝트를 붙일 수 있다
- 데이터 규모(건물 10·대상자 15·경보일 며칠)가 어떤 관리형 Postgres의 무료 구간에도 한참 못 미친다 — 성능·용량은 선택 기준이 되지 못한다

## 검토한 대안 (Alternatives)

- **Neon (Vercel Marketplace)** — ADR-0011이 후보로 적어둔 선택지. Vercel이 `DATABASE_URL`을 자동 주입해 env 설정이 한 단계 줄어드는 것이 실질 장점이다. 그럼에도 기각: 대시보드·계정이 하나 늘고, 이 프로젝트는 Prisma 도구(Studio·`postgres link`·`create-db`)를 이미 쓰고 있어 통합 이득이 더 크다. **Vercel 통합 편의를 우선한다면 합리적인 대안이며, 교체 비용은 연결 문자열 하나다**
- **Vercel Postgres** — 현재 Neon 기반 마켓플레이스 상품이라 위 항목과 같은 판단
- **Supabase** — Auth·Storage·Realtime을 함께 얻지만 v0에 필요 없는 표면이 넓다. 기각
- **SQLite 유지 + VM/Fly.io 배포** — 파일 저장소를 지키려 인프라 작업을 늘리는 선택. 48h 예산 초과로 기각(ADR-0011이 이미 검토)
- **SQLite 유지 + 로컬 데모만** — 공개 URL 요구를 충족 못 함

## 결과 (Consequences)

- 긍정: 배포 가능한 저장소 확보. 마이그레이션 이력이 파일로 남아 팀원·CI·배포가 같은 스키마를 재현한다. Prisma Console에서 배포 DB 데이터를 바로 본다
- 부정/트레이드오프:
  - **로컬 개발에도 네트워크가 필요하다.** SQLite 파일처럼 오프라인으로 못 쓴다. 비행기·행사장 오프라인 상황에서는 `npx create-db`로 새 DB를 받거나 로컬 Postgres를 띄워야 한다
  - **`npx create-db` DB는 24시간 뒤 삭제된다.** 출력된 claim URL로 클레임해야 영구 보존된다. 데모 DB는 반드시 클레임하거나 Console에서 만든 영구 DB를 쓴다
  - Preview 배포와 Production 배포가 같은 DB를 공유하면 PR의 마이그레이션이 병합 전에 운영 DB에 적용된다. 두 환경에는 별도 DB와 각각의 `DATABASE_URL`·`DIRECT_URL`을 설정한다
  - 서버리스 커넥션 한도를 신경 써야 한다 — 풀러 엔드포인트 + 작은 `max`로 대응
  - 상태값은 여전히 `String`이다. Postgres는 enum을 지원하지만 값 추가마다 마이그레이션이 필요하고 `src/lib/domain.ts`의 가드가 이미 방어선이라 v0에서는 바꾸지 않는다. `RiskAssessment.reasons`의 JSON 문자열 → `Json` 타입 전환도 같은 이유로 후속 과제
  - **[ADR-0011](0011-deploy-local-demo-first.md)의 "데모는 로컬 실행 기본"은 유지한다.** 배포 URL은 심사위원 접속용 보조 경로이지 데모 진행 경로가 아니다 — 행사장 네트워크 리스크는 그대로다
- 되돌리기: `provider` 한 줄 + `src/lib/db.ts` 어댑터 교체 + 마이그레이션 재생성. 다른 Postgres(Neon 등)로 옮기는 것은 연결 문자열 교체로 끝난다
