# Vercel 배포

> 배포 URL은 **심사위원 접속용 보조 경로**다. 데모 진행 자체는 발표 노트북의 로컬 실행이 기본이다([ADR-0011](adr/0011-deploy-local-demo-first.md)) — 행사장 네트워크 리스크는 배포로 사라지지 않는다.

## 1. 영구 DB 준비

`npx create-db@latest`로 받은 DB는 **24시간 뒤 삭제된다.** 배포용으로는 둘 중 하나를 쓴다.

- 발급 시 출력된 **claim URL**로 클레임해 영구 전환
- 또는 [console.prisma.io](https://console.prisma.io)에서 프로젝트를 만들고 연결 문자열을 발급

Prisma Console에서 두 연결 문자열을 모두 복사한다. 서버리스 런타임은 **풀러
엔드포인트**, 마이그레이션·Studio 같은 Prisma CLI는 **direct 엔드포인트**를 쓴다.

```
DATABASE_URL="postgres://USER:PASSWORD@pooled.db.prisma.io:5432/postgres?sslmode=require"
DIRECT_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"
```

Preview와 Production은 서로 다른 DB를 준비한다. 같은 DB를 공유하면 PR의
마이그레이션이 병합 전에 Production DB에 적용된다.

## 2. Vercel 프로젝트 생성

GitHub 저장소를 Vercel에 연결한다. Framework Preset은 Next.js가 자동 인식된다.

빌드 명령은 건드리지 않는다 — `package.json`의 `vercel-build`를 Vercel이 우선 사용한다.

```json
"vercel-build": "prisma migrate deploy && next build"
```

배포마다 `prisma/migrations/`의 마이그레이션이 적용된 뒤 빌드된다. **시드는 빌드에 넣지 않는다** — 배포할 때마다 담당자가 남긴 확인 기록이 지워진다.

## 3. 환경변수

Vercel 프로젝트 Settings → Environment Variables에 넣는다. **`DIRECT_URL`을 빠뜨리면
`vercel-build`의 `prisma migrate deploy` 단계에서 실패하고, `DATABASE_URL`을 빠뜨리면
런타임 DB 요청이 실패한다.** Production에는 운영 DB 값, Preview에는 별도 프리뷰 DB
값을 넣는다.

CLI로 넣을 수도 있다:

```bash
vercel link
printf '%s' "$DATABASE_URL" | vercel env add DATABASE_URL production --sensitive
printf '%s' "$DIRECT_URL"   | vercel env add DIRECT_URL production --sensitive
# 별도 프리뷰 DB의 값을 셸에 설정한 뒤 같은 두 키를 preview 환경에도 추가한다
printf '%s' "$DATABASE_URL" | vercel env add DATABASE_URL preview --sensitive
printf '%s' "$DIRECT_URL"   | vercel env add DIRECT_URL preview --sensitive
```


| 키 | 값 | 노출 |
|---|---|---|
| `DATABASE_URL` | Prisma Postgres 풀러 연결 문자열 | 서버 전용 |
| `DIRECT_URL` | Prisma Postgres direct 연결 문자열(마이그레이션) | 서버 전용 |
| `PUBLIC_DATA_SERVICE_KEY` | 공공데이터포털 서비스키 | 서버 전용 |
| `KAKAO_REST_KEY` | 카카오 REST API 키(지오코딩·자동차 최단 경로) | 서버 전용 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오맵 JS 앱 키 | 클라이언트 노출 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push VAPID 공개키 | 클라이언트 노출 |
| `VAPID_PRIVATE_KEY` | Web Push VAPID 비밀키 | 서버 전용 |
| `VAPID_SUBJECT` | `mailto:` 또는 `https:` 형식의 Push 운영 연락처 | 서버 전용 |
| `CRON_SECRET` | 오전 알림 발송 Route Handler 인증 토큰(16자 이상 권장) | 서버 전용 |

`NEXT_PUBLIC_` 접두사는 카카오맵 JS 키와 VAPID **공개키**에만 붙인다. VAPID 비밀키를 포함한 서버 전용 키에 붙이면 번들에 그대로 실린다(AGENTS.md 금지 사항).

VAPID 키 쌍은 로컬에서 한 번 생성해 같은 공개·비밀키를 Production 환경에 함께 넣는다.

```bash
npm run push:keys
```

## 4. 오전 8시 예약 발송

`vercel.json`은 매일 `23:00 UTC`(한국시간 오전 8시)에
`GET /api/notifications/dispatch`를 호출한다. Vercel은 `CRON_SECRET`을
`Authorization: Bearer ...` 헤더로 전달하고 Route Handler가 같은 값인지 검증한다.

Hobby 플랜의 일 단위 Cron은 호출 시각이 한 시간 범위로 지연될 수 있다. 정확한 오전 8시가
운영 요구라면 Pro 이상의 분 단위 정밀도를 사용한다. 로컬 데모의 수동 경보는 예약을 기다리지
않고 즉시 알림을 발송한다.

## 5. 카카오맵 도메인 등록

Kakao Developers → 내 애플리케이션 → 플랫폼 → Web에 **배포 도메인을 추가**한다(`https://<프로젝트>.vercel.app`). 등록하지 않으면 배포 환경에서만 지도가 뜨지 않는다([ADR-0007](adr/0007-kakao-map.md)).

프리뷰 배포는 도메인이 매번 바뀌므로, 지도를 프리뷰에서 확인하려면 고정 도메인을 쓰거나 그 도메인을 추가로 등록한다.

## 6. 배포 후 시드

시드는 로컬에서 **배포 DB를 향해** 한 번만 돌린다.

```bash
DATABASE_URL="$DIRECT_URL" npm run db:seed
```

건축HUB·카카오 실호출이 필요하므로 로컬 `.env`의 API 키가 채워져 있어야 한다. 시드는 기존 데이터를 모두 지우고 다시 만든다 — 배포 후 재실행하면 확인 기록도 사라진다.

## 7. 확인

```bash
curl -X POST https://<도메인>/api/trigger \
  -H 'Content-Type: application/json' \
  -d '{"level":"EMERGENCY","targetDate":"20260822"}'
```

`/today`에서 대응 보드가 뜨면 정상이다. 발령 전에는 "오늘은 경보가 없습니다"만 보이는 게 정상 동작이다(침묵이 스펙, PRD §9).

## 문제 해결

| 증상 | 원인 |
|---|---|
| 빌드 로그에 연결 URL 누락 오류 | **`DIRECT_URL` 미설정.** `prisma migrate deploy`가 direct 연결 문자열을 못 찾은 것이다. Production·Preview에 각각 넣어야 한다 |
| 런타임에 `DATABASE_URL이 없습니다` | 빌드는 통과했으나 함수 실행 환경에 변수가 없음 |
| `prisma migrate deploy`의 lock·세션 오류 | pooled URL을 사용했을 수 있다. `DIRECT_URL`이 `db.prisma.io`인지 확인 |
| 그 밖의 `prisma migrate deploy` 실패 | 마이그레이션이 커밋되지 않았거나 DB가 다른 스키마 상태. `npx prisma migrate status`로 확인 |
| 지도만 안 뜸 | 카카오 플랫폼에 배포 도메인 미등록 (4번) |
| 커넥션 부족 | 직접 연결(`db.prisma.io`) 대신 풀러(`pooled.db.prisma.io`) 사용 |
