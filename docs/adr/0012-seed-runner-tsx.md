# ADR-0012: 시드 스크립트 실행기로 tsx를 쓰고, 시드는 공공데이터 실호출로 만든다

- **상태**: 승인됨
- **날짜**: 2026-08-22
- **결정자**: 팀 전원

## 맥락 (Context)

PRD §8의 대상자 15명은 합성 데이터지만 **건물은 실제 건축물대장 값**이어야 하고(원칙 "건물은 진짜, 사람은 가짜"), 해커톤 요건상 공공데이터 실사용이 필수다. 따라서 시드 스크립트가 국토부 건축HUB·카카오 로컬 API를 실제로 호출해 `Building`을 채워야 한다. 시드는 TypeScript로 작성해 `src/lib/`의 도메인 코드(스코어링 엔진, 도메인 상수)를 재사용해야 하는데, Node 20([ADR-0010](0010-npm-node20.md))은 TS를 직접 실행하지 못한다.

## 결정 (Decision)

- 시드 실행기로 **`tsx`**(devDependency)를 도입하고 `prisma.config.ts`의 `migrations.seed`에 `tsx prisma/seed.ts`를 등록한다. 실행은 `npm run db:seed`.
- 시드는 **건축HUB `getBrTitleInfo`(표제부)에서 법정동 단위로 실건물 목록을 받아** 연도·용도 분포가 고르게 되도록 선별하고, 카카오 로컬 API로 좌표를 얻는다. 주소를 손으로 적지 않는다 — 실존하지 않는 주소가 섞일 여지를 원천 차단.
- 키가 없거나 API가 실패하면 시드는 **가짜 건물로 폴백하지 않고 실패**한다. 데모 안정성은 시드 결과가 `dev.db`에 고정되는 것으로 확보한다([ADR-0011](0011-deploy-local-demo-first.md)).
- 추적 가능성을 위해 `Building`에 건축물대장 관리번호(`mgmBldrgstPk`)·주용도·지붕·층수·법정동코드를 저장한다.

## 근거 (Rationale)

- `tsx`는 설정 없이 `tsconfig.json`의 `paths`(`@/*`)를 인식하므로 `src/lib/db.ts`·`scoring/`을 그대로 import 가능. Prisma 공식 문서의 권장 조합
- 법정동 단위 조회는 "진짜 건물"을 보장하면서도 연도·구조 분포를 코드로 제어할 수 있어 등급 컷오프 캘리브레이션([ADR-0005](0005-rule-based-risk-model.md))에 유리

## 검토한 대안 (Alternatives)

- **ts-node** — ESM·paths 설정이 번거롭고 느림. 기각
- **Node 22 `--experimental-strip-types`** — 런타임을 Node 22로 올려야 하며 `paths` 미지원. ADR-0010과 충돌. 기각
- **주소 목록 하드코딩 + 건축HUB 개별 조회** — 실존 주소 검증 부담, 오타 시 가짜 건물 혼입 위험. 기각
- **JSON 픽스처로 건물 데이터 커밋** — 공공데이터 실호출 요건 미충족. 기각 (단, 시드 *결과*를 `dev.db`에 고정하는 것은 허용)

## 결과 (Consequences)

- 긍정: 건물 데이터의 출처가 API 응답 그 자체이며 관리번호로 검증 가능. 도메인 코드 재사용
- 부정/트레이드오프: 시드에 `PUBLIC_DATA_SERVICE_KEY`·`KAKAO_REST_KEY`가 필요 — 키 없는 팀원은 시드된 `dev.db` 파일을 공유받아야 함. 시드 대상 지역은 `prisma/seed/config.ts`에서 바꾼다
- 되돌리기: 실행기 교체는 `prisma.config.ts` 한 줄. 선별 로직은 `prisma/seed/`에 격리
