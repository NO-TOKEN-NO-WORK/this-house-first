# 현재 날씨 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기상청 초단기실황의 현재 기온과 습도로 체감온도를 계산해 관리자·생활지원사 웹에 10분 캐시로 표시한다.

**Architecture:** 기존 공공데이터 공통 클라이언트와 KMA 모듈에 초단기실황을 추가하고 Next fetch 데이터 캐시를 600초 사용한다. 브라우저는 `/api/public-data/current-weather`만 호출하며 공용 Client Component가 관리자·생활지원사 화면의 로딩·성공·실패 상태를 렌더링한다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript strict, 기상청 공공데이터 API, Vitest 4, Tailwind CSS 4, 기존 관리자 CSS Module

**Spec:** `docs/superpowers/specs/2026-08-22-current-weather-design.md`

## Global Constraints

- 새 npm 의존성과 Prisma 스키마 변경을 하지 않는다.
- `PUBLIC_DATA_SERVICE_KEY`, `KMA_GRID_NX`, `KMA_GRID_NY`는 서버에서만 읽고 `NEXT_PUBLIC_*`으로 노출하지 않는다.
- 현재 관측값은 `AlertDay.feelsLikeMax`와 위험도 평가를 수정하지 않는다.
- 외부 API는 `/api/public-data/current-weather` Route Handler가 호출하고 브라우저는 이 내부 API만 사용한다.
- 생활지원사·공용 Tailwind UI는 `src/app/globals.css`의 Semantic 토큰만 사용한다.
- 관리자 UI는 기존 `tokens.css`와 CSS Module 체계를 유지한다.
- 새 동작은 실패 테스트를 먼저 실행한 뒤 최소 구현으로 통과시킨다.
- 구현 전 `node_modules/next/dist/docs/`의 Route Handler, fetch 캐시, Client Component 문서를 읽는다.

---

### Task 1: 초단기실황과 600초 서버 캐시

**Files:**
- Modify: `src/lib/public-data/client.ts`
- Modify: `src/lib/public-data/kma.ts`
- Modify: `src/lib/public-data/kma.test.ts`

**Interfaces:**
- Consumes: `fetchPublicDataJson()`, `calculateSummerFeelsLikeTemperature()`, `PUBLIC_DATA_SERVICE_KEY`
- Produces: `CurrentWeather`, `ObservationBase`, `resolveObservationBase()`, `getCurrentWeather()`, `fetchPublicDataJson(url, fetcher, { revalidateSeconds })`

- [ ] **Step 1: 관측 기준시각과 KMA 파싱 실패 테스트 작성**

`src/lib/public-data/kma.test.ts`에 14:09·14:10·00:05 기준시각과 `T1H=31.2`, `REH=68` 응답의 현재 날씨 변환 테스트를 추가한다. custom fetcher가 받은 `init.next`가 `{ revalidate: 600 }`인지도 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/lib/public-data/kma.test.ts`

Expected: `resolveObservationBase` 또는 `getCurrentWeather` export가 없어 FAIL.

- [ ] **Step 3: 공통 클라이언트 캐시 옵션 최소 구현**

`fetchPublicDataJson`의 세 번째 인자로 `{ revalidateSeconds?: number }`를 받고, 값이 있으면 `cache: "no-store"` 대신 다음 Next fetch 옵션을 전달한다.

```ts
type NextRequestInit = RequestInit & { next?: { revalidate: number } };

const init: NextRequestInit = {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(8_000),
  ...(options.revalidateSeconds == null
    ? { cache: "no-store" }
    : { next: { revalidate: options.revalidateSeconds } }),
};
```

- [ ] **Step 4: 초단기실황 최소 구현**

`kma.ts`에 `getUltraSrtNcst` URL, `ObservationBase`, `CurrentWeather`, `resolveObservationBase()`, `getCurrentWeather()`를 추가한다. `T1H`와 `REH`가 모두 있어야 성공하며 기존 체감온도 함수를 재사용한다.

- [ ] **Step 5: 단위 테스트 통과 확인**

Run: `npm test -- src/lib/public-data/kma.test.ts src/lib/public-data/client.test.ts`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/public-data/client.ts src/lib/public-data/kma.ts src/lib/public-data/kma.test.ts
git commit -m "feat: add cached current weather lookup"
```

### Task 2: 현재 날씨 Route Handler

**Files:**
- Create: `src/app/api/public-data/current-weather/route.ts`
- Create: `src/app/api/public-data/current-weather/route.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `getCurrentWeather({ nx, ny })`, `toPublicDataErrorResponse()`, `KMA_GRID_NX`, `KMA_GRID_NY`
- Produces: `GET /api/public-data/current-weather` → `{ data: CurrentWeather }`

- [ ] **Step 1: Route Handler 실패 테스트 작성**

환경변수 누락·비정상 좌표는 `503 MISSING_WEATHER_GRID`, 정상 좌표는 mock `getCurrentWeather`에 숫자로 전달하고 `{ data }`를 반환하는 테스트를 작성한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/app/api/public-data/current-weather/route.test.ts`

Expected: route 모듈이 없어 FAIL.

- [ ] **Step 3: Route Handler 최소 구현**

서버 환경변수를 1~3자리 정수로 검증하고 `getCurrentWeather()`를 호출한다. 모든 `PublicDataError`는 기존 `toPublicDataErrorResponse()`로 변환한다.

- [ ] **Step 4: 환경변수 예시 추가**

`.env.example`의 공공데이터 설정 아래에 `KMA_GRID_NX=""`, `KMA_GRID_NY=""`와 서버 전용 주석을 추가한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- src/app/api/public-data/current-weather/route.test.ts`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add .env.example src/app/api/public-data/current-weather
git commit -m "feat: expose current weather endpoint"
```

### Task 3: 관리자·생활지원사 공용 날씨 컴포넌트

**Files:**
- Create: `src/components/CurrentWeatherSummary.tsx`
- Create: `src/components/CurrentWeatherSummary.test.tsx`
- Modify: `src/app/globals.css` only if an existing Semantic token cannot express the required layout

**Interfaces:**
- Consumes: `GET /api/public-data/current-weather`
- Produces: `<CurrentWeatherSummary variant="today" | "admin" />`

- [ ] **Step 1: 표시 계약 실패 테스트 작성**

성공 데이터에서 `현재 기온 31.2°C`, `현재 체감 32.3°C`, 관측시각을 표시하고 오류 payload에서는 `현재 날씨를 불러오지 못했습니다`를 표시하는 테스트를 작성한다. 네트워크 상태 전이는 exported `requestCurrentWeather(fetcher)` 함수로 분리해 테스트한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/components/CurrentWeatherSummary.test.tsx`

Expected: 컴포넌트 모듈이 없어 FAIL.

- [ ] **Step 3: 공용 컴포넌트 최소 구현**

마운트 시 내부 API를 호출하고 600,000ms마다 갱신한다. cleanup에서 interval과 진행 중 요청 반영을 중지한다. 현재 값을 얻지 못해도 페이지 나머지는 렌더링한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/CurrentWeatherSummary.test.tsx`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/components/CurrentWeatherSummary.tsx src/components/CurrentWeatherSummary.test.tsx src/app/globals.css
git commit -m "feat: add shared current weather summary"
```

### Task 4: 두 웹 화면 연결과 고정 관리자 메타 제거

**Files:**
- Modify: `src/app/today/page.tsx`
- Modify: `src/app/today/page.test.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/page.test.tsx`
- Modify: `src/components/admin/AdminSubjectViews.tsx`
- Modify: `src/components/admin/AdminSubjectViews.test.tsx`
- Modify: `src/components/admin/admin-subject.module.css` if layout adjustment is required

**Interfaces:**
- Consumes: `<CurrentWeatherSummary variant="today" | "admin" />`
- Produces: 경보 여부와 무관한 관리자·생활지원사 현재 날씨 표시

- [ ] **Step 1: 화면 포함 실패 테스트 작성**

`/today`, `/admin`, 관리자 공용 헤더의 정적 렌더 결과에 `현재 날씨` 영역이 포함되는지 검증하고, 관리자 공용 헤더가 고정 `14:32`를 더 이상 렌더링하지 않는지 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/app/today/page.test.tsx src/app/admin/page.test.tsx src/components/admin/AdminSubjectViews.test.tsx`

Expected: 현재 날씨 영역이 없어 FAIL.

- [ ] **Step 3: 생활지원사 화면 연결**

인사말 아래에 `variant="today"`를 배치해 경보일·비경보일에서 공통으로 보이게 한다. 기존 경보 배너의 `board.feelsLikeMax`는 `오늘 최고 체감` 의미로 유지한다.

- [ ] **Step 4: 관리자 화면 연결**

관리자 TopBar와 `AdminManagementHeader`에 `variant="admin"`을 배치한다. 고정 갱신시각 `14:32`를 삭제하고 신규 관리 화면 날짜 기본값은 `todayInKst()` 또는 페이지에서 전달한 실제 날짜로 바꾼다.

- [ ] **Step 5: 화면 테스트 통과 확인**

Run: `npm test -- src/app/today/page.test.tsx src/app/admin/page.test.tsx src/components/admin/AdminSubjectViews.test.tsx`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/app/today src/app/admin src/components/admin src/components/CurrentWeatherSummary.tsx
git commit -m "feat: show current weather across care views"
```

### Task 5: 문서와 전체 검증

**Files:**
- Modify: `docs/public-data-apis.md`
- Modify: `docs/deploy-vercel.md`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: 구현된 API·환경변수·UI 동작
- Produces: 설정 및 운영 문서

- [ ] **Step 1: 문서 갱신**

초단기실황 endpoint, 10분 캐시, `KMA_GRID_NX/Y`, 현재 관측값과 `AlertDay.feelsLikeMax`의 차이를 기록한다.

- [ ] **Step 2: 집중 테스트**

Run: `npm test -- src/lib/public-data src/app/api/public-data/current-weather src/components/CurrentWeatherSummary.test.tsx src/app/today/page.test.tsx src/app/admin/page.test.tsx`

Expected: PASS.

- [ ] **Step 3: 전체 검증**

Run: `npm test && npm run lint && npm run build`

Expected: 모두 exit 0.

- [ ] **Step 4: 고정값·보안 회귀 검색**

Run: `rg -n '14:32|2026-08-22|NEXT_PUBLIC_.*KMA|PUBLIC_DATA_SERVICE_KEY' src/components/admin src/app .env.example`

Expected: 관리자 UI 고정 `14:32`와 신규 관리 화면 고정 날짜 없음. 서비스키는 서버 코드와 `.env.example`에만 존재.

- [ ] **Step 5: 커밋**

```bash
git add docs .env.example src
git commit -m "docs: document current weather integration"
```
