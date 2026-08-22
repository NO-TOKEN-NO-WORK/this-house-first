# 관리자 관제 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 경보일의 미확인 1등급·가구 상태를 지도와 우선순위 목록으로 보여주는 `/admin` 관리자 관제 대시보드를 구현한다.

**Architecture:** `src/lib/admin/dashboard.ts`가 Prisma 행을 관리자 화면 전용 읽기 모델로 한 번 정규화하고, `/admin` Server Component가 이를 직접 소비한다. 카카오 지도·10초 새로고침·데모 발령만 Client Component로 격리하며 별도 관리자 API와 새 의존성은 만들지 않는다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript strict, Prisma 7/PostgreSQL, Tailwind CSS 4 + CSS Module, Kakao Maps JavaScript SDK, Vitest 4

**Spec:** `docs/superpowers/specs/2026-08-22-admin-dashboard-design.md`

## Global Constraints

- `AGENTS.md`, `docs/PRD.md`, `docs/architecture.md`, ADR-0007·0008·0011·0014를 따른다.
- 상태 문자열은 `src/lib/domain.ts` 상수와 가드만 사용한다.
- 위험 사유는 저장된 스코어링 엔진 문자열을 재작성하지 않는다.
- 비경보일에는 알림이나 `AlertDay`를 만들지 않는다.
- 새 npm 의존성과 Prisma 스키마 변경은 금지한다.
- FR-7 방문 경로와 FR-9 일일 리포트는 이번 계획에 포함하지 않는다.
- UI 구현 전에 `node_modules/next/dist/docs/`에서 App Router의 Server/Client Component, `useRouter`, CSS Module 문서를 읽는다.
- Hallmark UI 작업 전에 다음 파일을 읽는다: `references/genres/modern-minimal.md`, `references/themes/cobalt.md`, `references/macrostructures/19-map-diagram.md`, `references/components/n9-edge-aligned-minimal.md`, `references/components/ft2-inline-rule-single-line.md`, `references/typography.md`, `references/color.md`, `references/layout-and-space.md`, `references/motion.md`, `references/copy.md`, `references/anti-patterns.md`, `references/microinteractions.md`, `references/interaction-and-states.md`, `references/responsive.md`.
- 새 동작은 실패 테스트를 먼저 실행한 후 최소 구현으로 통과시킨다.
- 작업 시작 시 `superpowers:using-git-worktrees`로 현재 격리 상태와 베이스라인을 확인한다.

---

### Task 1: 관리자 집계 읽기 모델

**Files:**
- Create: `src/lib/admin/dashboard.ts`
- Create: `src/lib/admin/dashboard.test.ts`

**Interfaces:**
- Consumes: `AlertLevel`, `RiskGrade`, `HouseholdStatus`, `WorkerRole`, `isOpenHouseholdStatus`, `HOUSEHOLD_STATUS_LABEL`, `prisma`, `formatBoardDate`, `todayInKst`
- Produces: `AdminDashboard`, `AdminAlertedDashboard`, `AdminDashboardBuilding`, `AdminDashboardSubject`, `AdminDashboardWorker`, `AdminStatusCategory`, `AdminAssessmentRow`, `AdminStatusRow`, `buildAdminSnapshot()`, `getAdminDashboard()`

- [ ] **Step 1: 집계 동작을 고정하는 실패 테스트 작성**

`src/lib/admin/dashboard.test.ts`에 실제 행 모양의 고정 fixture를 만들고 다음 두 테스트를 작성한다.

```ts
import { describe, expect, it } from "vitest";
import { HouseholdStatus } from "../domain";
import {
  buildAdminSnapshot,
  type AdminAssessmentRow,
  type AdminStatusRow,
} from "./dashboard";

const assessments: AdminAssessmentRow[] = [
  {
    subjectId: "subject-critical",
    score: 31.5,
    grade: 1,
    reasons: JSON.stringify(["1938년생 (88세)·독거", "오늘 비상 단계"]),
    subject: {
      id: "subject-critical",
      name: "김○○",
      workerId: "worker-a",
      worker: { name: "이담당" },
      building: {
        id: "building-a",
        address: "대구광역시 서구 비산동 1",
        roadAddress: null,
        lat: 35.87,
        lng: 128.56,
      },
    },
  },
  {
    subjectId: "subject-visit",
    score: 12,
    grade: 2,
    reasons: JSON.stringify(["1948년생 (78세)", "오늘 비상 단계"]),
    subject: {
      id: "subject-visit",
      name: "박○○",
      workerId: "worker-a",
      worker: { name: "이담당" },
      building: {
        id: "building-a",
        address: "대구광역시 서구 비산동 1",
        roadAddress: null,
        lat: 35.87,
        lng: 128.56,
      },
    },
  },
  {
    subjectId: "subject-closed",
    score: 26,
    grade: 1,
    reasons: "not-json",
    subject: {
      id: "subject-closed",
      name: "최○○",
      workerId: "worker-b",
      worker: { name: "박담당" },
      building: {
        id: "building-b",
        address: "대구광역시 서구 비산동 2",
        roadAddress: "대구광역시 서구 비산로 2",
        lat: 35.88,
        lng: 128.57,
      },
    },
  },
];

const statuses: AdminStatusRow[] = [
  { subjectId: "subject-visit", status: HouseholdStatus.VISIT_QUEUED },
  { subjectId: "subject-closed", status: HouseholdStatus.CALL_OK },
];

describe("buildAdminSnapshot", () => {
  it("미확인 1등급·방문 대기·건물 최고 위험도를 같은 행 집합에서 계산한다", () => {
    const result = buildAdminSnapshot({ assessments, statuses });

    expect(result.summary).toEqual({
      total: 3,
      open: 2,
      openCritical: 1,
      visitQueued: 1,
      completed: 1,
    });
    expect(result.subjects.map((subject) => subject.subjectId)).toEqual([
      "subject-critical",
      "subject-visit",
      "subject-closed",
    ]);
    expect(result.subjects[0]?.status).toBe(HouseholdStatus.UNCHECKED);
    expect(result.subjects[2]?.reasons).toEqual([
      "위험 사유를 불러오지 못했습니다",
    ]);
    expect(result.buildings[0]).toMatchObject({
      buildingId: "building-a",
      grade: 1,
      score: 31.5,
      statusCategory: "visit",
      openCount: 2,
    });
  });

  it("담당자 필터는 다른 담당자의 데이터를 섞지 않는다", () => {
    const result = buildAdminSnapshot({
      assessments,
      statuses,
      workerId: "worker-b",
    });

    expect(result.summary.total).toBe(1);
    expect(result.subjects.map((subject) => subject.workerName)).toEqual([
      "박담당",
    ]);
    expect(result.buildings.map((building) => building.buildingId)).toEqual([
      "building-b",
    ]);
  });
});
```

- [ ] **Step 2: 테스트가 기능 부재로 실패하는지 확인**

Run: `npm test -- src/lib/admin/dashboard.test.ts`

Expected: FAIL because `src/lib/admin/dashboard.ts` 또는 `buildAdminSnapshot`이 존재하지 않는다.

- [ ] **Step 3: 최소 집계 로직 구현**

`src/lib/admin/dashboard.ts`에 설계 문서의 타입을 정의한다. Prisma와 무관한 핵심은 아래 형태로 구현한다.

```ts
const STATUS_CATEGORY: Record<HouseholdStatus, AdminStatusCategory> = {
  [HouseholdStatus.EMERGENCY_119]: "emergency",
  [HouseholdStatus.VISITING]: "visit",
  [HouseholdStatus.VISIT_QUEUED]: "visit",
  [HouseholdStatus.NO_ANSWER_1]: "unchecked",
  [HouseholdStatus.UNCHECKED]: "unchecked",
  [HouseholdStatus.UNREACHABLE]: "unreachable",
  [HouseholdStatus.CALL_OK]: "called",
  [HouseholdStatus.RESOLVED]: "resolved",
};

const STATUS_PRIORITY: Record<AdminStatusCategory, number> = {
  emergency: 1,
  visit: 2,
  unchecked: 3,
  unreachable: 4,
  called: 5,
  resolved: 6,
};

function parseReasons(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      return value;
    }
  } catch {
    // 사실을 숨기지 않는 폴백을 아래에서 반환한다.
  }
  return ["위험 사유를 불러오지 못했습니다"];
}
```

`buildAdminSnapshot({ assessments, statuses, workerId })`는 다음 순서를 그대로 따른다.

```ts
const statusBySubject = new Map(statuses.map((row) => [row.subjectId, row.status]));
const selectedRows = workerId
  ? assessments.filter((row) => row.subject.workerId === workerId)
  : assessments;

const subjects = selectedRows
  .map((row) => {
    const status = statusBySubject.get(row.subjectId) ?? HouseholdStatus.UNCHECKED;
    return {
      subjectId: row.subjectId,
      name: row.subject.name,
      workerId: row.subject.workerId,
      workerName: row.subject.worker.name,
      buildingId: row.subject.building.id,
      address: row.subject.building.roadAddress ?? row.subject.building.address,
      lat: row.subject.building.lat,
      lng: row.subject.building.lng,
      grade: row.grade,
      score: row.score,
      reasons: parseReasons(row.reasons),
      status,
      statusLabel: HOUSEHOLD_STATUS_LABEL[status],
      open: isOpenHouseholdStatus(status),
    };
  })
  .sort(
    (left, right) =>
      Number(right.open) - Number(left.open) ||
      left.grade - right.grade ||
      right.score - left.score ||
      left.name.localeCompare(right.name, "ko"),
  );
```

건물은 `Map<string, AdminDashboardBuilding>`에 대상자를 한 번씩 추가한다. `grade`는 작은 숫자, `score`는 큰 숫자, `statusCategory`는 작은 `STATUS_PRIORITY`를 유지하고 마지막에 `score` 내림차순으로 정렬한다. 요약은 같은 `subjects` 배열을 한 번 순회해 계산한다.

- [ ] **Step 4: 서버 조회 함수 구현**

`getAdminDashboard()`는 다음 세 조회를 수행한다.

```ts
const [workers, alertDay] = await Promise.all([
  prisma.worker.findMany({
    where: { role: WorkerRole.WORKER },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  }),
  prisma.alertDay.findUnique({ where: { date } }),
]);
```

`alertDay`가 없으면 `alerted: false`, 빈 `subjects`·`buildings`, `generatedAt`을 반환한다. 있으면 `riskAssessment.findMany`와 `householdDayStatus.findMany`를 `Promise.all`로 읽고 `buildAdminSnapshot()` 결과를 합쳐 `AdminAlertedDashboard`를 반환한다. `RiskGrade`와 `HouseholdStatus`는 각각 `isRiskGrade`·`parseHouseholdStatus`로 검증한다.

- [ ] **Step 5: 집중 테스트와 전체 테스트 확인**

Run: `npm test -- src/lib/admin/dashboard.test.ts`

Expected: PASS, 2 tests.

Run: `npm test`

Expected: 기존 테스트와 신규 테스트 모두 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/admin/dashboard.ts src/lib/admin/dashboard.test.ts
git commit -m "feat: 관리자 관제 집계 모델을 추가한다"
```

---

### Task 2: 관리자 서버 화면과 스타일 시스템

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/page.test.tsx`
- Create: `src/app/admin/admin.module.css`
- Create: `tokens.css`
- Create: `.hallmark/preflight.json`
- Create: `.hallmark/log.json`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `getAdminDashboard()`, `AdminDashboard`, `AdminAlertedDashboard`, `RiskGrade`, `GRADE_LABEL`, `isIsoDate`
- Produces: `/admin`, `AdminDashboardView`, `SummaryCards`, `PriorityList`, 관리자 CSS 토큰

- [ ] **Step 1: 관련 Next.js·Hallmark 문서 읽기**

Run:

```bash
rg -n "Server Component|Client Component|CSS Module|searchParams" node_modules/next/dist/docs/
sed -n '1,240p' /Users/byunghak/.agents/skills/hallmark/references/macrostructures/19-map-diagram.md
sed -n '1,240p' /Users/byunghak/.agents/skills/hallmark/references/themes/cobalt.md
sed -n '1,200p' /Users/byunghak/.agents/skills/hallmark/references/components/n9-edge-aligned-minimal.md
sed -n '1,200p' /Users/byunghak/.agents/skills/hallmark/references/components/ft2-inline-rule-single-line.md
```

Expected: Next 16의 현재 App Router 규약과 승인된 Hallmark 구조를 확인한다.

- [ ] **Step 2: 서버 렌더링 핵심 정보를 검증하는 실패 테스트 작성**

`src/app/admin/page.test.tsx`에서 `react-dom/server`만 사용한다.

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AlertLevel, HouseholdStatus } from "@/lib/domain";
import { AdminDashboardView, PriorityList, SummaryCards } from "./page";

describe("관리자 관제 화면", () => {
  it("핵심 위젯과 위험도 우선 대상을 텍스트로도 제공한다", () => {
    const summary = {
      total: 3,
      open: 2,
      openCritical: 1,
      visitQueued: 1,
      completed: 1,
    };
    const html = renderToStaticMarkup(
      <>
        <SummaryCards summary={summary} />
        <PriorityList
          subjects={[
            {
              subjectId: "subject-1",
              name: "김○○",
              workerId: "worker-1",
              workerName: "이담당",
              buildingId: "building-1",
              address: "대구광역시 서구 비산동 1",
              lat: 35.87,
              lng: 128.56,
              grade: 1,
              score: 31.5,
              reasons: ["1938년생 (88세)·독거"],
              status: HouseholdStatus.UNCHECKED,
              statusLabel: "미확인",
              open: true,
            },
          ]}
        />
      </>,
    );

    expect(html).toContain("미확인 1등급");
    expect(html).toContain("김○○");
    expect(html).toContain("이담당");
    expect(html).toContain("미확인");
    expect(html).toContain("1938년생 (88세)·독거");
  });

  it("비경보일에는 위험도를 만들지 않고 침묵 상태를 안내한다", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardView
        dashboard={{
          alerted: false,
          date: "2026-08-22",
          dateLabel: "8월 22일(토)",
          selectedWorkerId: null,
          workers: [],
          generatedAt: "2026-08-22T08:00:00.000Z",
          subjects: [],
          buildings: [],
        }}
        mapKey=""
      />,
    );

    expect(html).toContain("오늘은 경보가 없습니다");
    expect(html).not.toContain("1등급 0명");
  });
});
```

`AlertLevel` import는 alerted fixture가 추가될 때 사용하거나 사용하지 않으면 제거한다. lint 경고를 남기지 않는다.

- [ ] **Step 3: 테스트가 페이지 부재로 실패하는지 확인**

Run: `npm test -- src/app/admin/page.test.tsx`

Expected: FAIL because `src/app/admin/page.tsx`가 존재하지 않는다.

- [ ] **Step 4: 토큰과 CSS Module 작성**

`tokens.css`는 `:root` 안에 관리자 전용 색·간격·타이포·모션 토큰을 OKLCH로 정의한다. 위험등급 토큰은 기존 의미에 맞춰 `--color-danger`, `--color-warn`, `--color-calm`을 참조한다.

`src/app/admin/admin.module.css`의 첫 줄은 다음 Hallmark 스탬프로 시작한다.

```css
/* Hallmark · genre: modern-minimal · macrostructure: Map / Diagram · theme: Cobalt · enrichment: map · nav: N9 · footer: Ft2 */
@import "../../../tokens.css";
```

페이지는 CSS grid로 구현한다. 80rem 이상에서 `minmax(0, 2fr) minmax(20rem, 1fr)`, 그 아래에서는 한 열로 둔다. 지도 최소 높이는 데스크톱 36rem, 모바일 24rem이다. 모든 focusable 요소에 `:focus-visible` 링을 적용하고 `@media (prefers-reduced-motion: reduce)`에서 transform 전환을 제거한다.

`src/app/globals.css`에는 기존 규칙을 보존한 채 다음만 추가한다.

```css
html,
body {
  overflow-x: clip;
}
```

`.hallmark/preflight.json`에는 Next 16.3.2, Tailwind 4, 한국어 시스템 폰트, 기존 위험등급 팔레트, motion-cut을 기록한다. `.hallmark/log.json`에는 2026-08-22의 `Map / Diagram`, `Cobalt`, `map`, 관리자 관제 대시보드 항목 하나를 기록한다.

- [ ] **Step 5: Server Component와 순수 표시 컴포넌트 구현**

`src/app/admin/page.tsx`는 다음 경계를 유지한다.

```tsx
export const dynamic = "force-dynamic";

export default async function AdminPage(props: PageProps<"/admin">) {
  const params = await props.searchParams;
  const date = typeof params.date === "string" ? params.date : undefined;
  if (date !== undefined && !isIsoDate(date)) notFound();
  const workerId =
    typeof params.workerId === "string" ? params.workerId : undefined;
  const dashboard = await getAdminDashboard({ date, workerId });

  return (
    <AdminDashboardView
      dashboard={dashboard}
      mapKey={process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim() ?? ""}
    />
  );
}
```

`SummaryCards`는 네 개의 `<dl>` 항목을 렌더링한다. `PriorityList`는 `<ol>`과 대상자 상세 링크를 렌더링하고, 등급 옆에 `subject.reasons`를 문장 수정 없이 `<ul>`로 표시한다. 상세 링크는 `date`와 `workerId` 검색 파라미터를 유지한다. `AdminDashboardView`는 비경보일과 경보일을 분기하고 필터는 네이티브 GET `<form>`으로 만든다. 아직 없는 `AdminMap`과 `AdminControls`는 다음 작업 전까지 같은 파일의 접근 가능한 임시 영역으로 두지 말고, Task 3·4 완료 시 한 번에 import해 연결한다.

- [ ] **Step 6: 집중 테스트와 lint 확인**

Run: `npm test -- src/app/admin/page.test.tsx`

Expected: PASS, 2 tests.

Run: `npm run lint -- src/app/admin/page.tsx src/app/admin/page.test.tsx`

Expected: 0 errors.

- [ ] **Step 7: 커밋**

```bash
git add tokens.css .hallmark src/app/globals.css src/app/admin
git commit -m "feat: 관리자 관제 화면의 서버 셸을 추가한다"
```

---

### Task 3: 카카오 건물 지도

**Files:**
- Create: `src/components/admin/AdminMap.tsx`
- Create: `src/components/admin/AdminMap.test.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/admin.module.css`

**Interfaces:**
- Consumes: `AdminDashboardBuilding[]`, `NEXT_PUBLIC_KAKAO_MAP_KEY`, 관리자 CSS Module 클래스
- Produces: `AdminMap({ buildings, mapKey })`

- [ ] **Step 1: 실패 테스트 작성**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminMap } from "./AdminMap";

describe("AdminMap", () => {
  it("카카오 키가 없으면 목록을 막지 않는 설정 안내를 보여준다", () => {
    const html = renderToStaticMarkup(<AdminMap buildings={[]} mapKey="" />);
    expect(html).toContain("카카오 지도 키가 설정되지 않았습니다");
  });

  it("키와 건물이 있으면 접근 가능한 지도 영역을 만든다", () => {
    const html = renderToStaticMarkup(
      <AdminMap
        mapKey="test-key"
        buildings={[
          {
            buildingId: "building-1",
            address: "대구광역시 서구 비산동 1",
            lat: 35.87,
            lng: 128.56,
            grade: 1,
            score: 31.5,
            statusCategory: "unchecked",
            openCount: 1,
            subjects: [],
          },
        ]}
      />,
    );
    expect(html).toContain('aria-label="건물 위험도 지도"');
  });
});
```

- [ ] **Step 2: 기능 부재 실패 확인**

Run: `npm test -- src/components/admin/AdminMap.test.tsx`

Expected: FAIL because `AdminMap`이 존재하지 않는다.

- [ ] **Step 3: SDK 로더와 지도 구현**

`AdminMap.tsx`는 `"use client"`로 시작한다. `loadKakaoSdk(mapKey)`는 기존 `window.kakao`가 있으면 즉시 resolve하고, `script[data-admin-kakao-map]`이 있으면 같은 load/error 이벤트를 기다리며, 없으면 아래 URL을 사용한다.

```ts
const script = document.createElement("script");
script.dataset.adminKakaoMap = "true";
script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(mapKey)}&autoload=false`;
script.async = true;
document.head.appendChild(script);
```

SDK load 후 `window.kakao.maps.load()` 안에서 지도와 bounds를 만들고 각 건물에 `CustomOverlay`를 추가한다. 오버레이 content는 `document.createElement("button")`으로 만들며 다음 정보가 반드시 텍스트 또는 `aria-label`에 포함된다.

```ts
button.type = "button";
button.className = `${styles.mapMarker} ${styles[`grade${building.grade}`]} ${styles[building.statusCategory]}`;
button.textContent = String(building.openCount);
button.setAttribute(
  "aria-label",
  `${building.address}, ${building.grade}등급, 미처리 ${building.openCount}명`,
);
```

클릭 시 컴포넌트 state의 `selectedBuildingId`를 갱신하고 지도 아래 `<section aria-live="polite">`에 주소와 대상자별 이름·등급·`statusLabel`·`reasons`를 표시한다. `reasons` 문장은 재작성하지 않는다. effect cleanup은 생성한 overlays의 `setMap(null)`을 호출하고 지도 container를 비운다. SDK/초기화 실패는 `mapError` 한국어 메시지만 갱신한다.

- [ ] **Step 4: 페이지에 지도 연결**

`AdminDashboardView`의 관제 본문에서 `dashboard.buildings`와 `mapKey`를 `AdminMap`에 전달한다. 우측 `PriorityList`는 항상 함께 렌더링해 지도 실패가 정보 손실로 이어지지 않게 한다.

- [ ] **Step 5: 테스트와 lint 확인**

Run: `npm test -- src/components/admin/AdminMap.test.tsx src/app/admin/page.test.tsx`

Expected: PASS, 4 tests.

Run: `npm run lint -- src/components/admin/AdminMap.tsx src/components/admin/AdminMap.test.tsx`

Expected: 0 errors.

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/AdminMap.tsx src/components/admin/AdminMap.test.tsx src/app/admin/page.tsx src/app/admin/admin.module.css
git commit -m "feat: 관리자 건물 위험도 지도를 추가한다"
```

---

### Task 4: 자동 갱신과 데모 발령

**Files:**
- Create: `src/components/admin/AdminControls.tsx`
- Create: `src/components/admin/AdminControls.test.ts`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/admin.module.css`

**Interfaces:**
- Consumes: 기존 `POST /api/trigger`, 선택 날짜, `AlertLevel`
- Produces: `requestDemoTrigger()`, `AdminControls({ date })`

- [ ] **Step 1: 데모 발령 요청 실패 테스트 작성**

```ts
import { describe, expect, it, vi } from "vitest";
import { AlertLevel } from "@/lib/domain";
import { requestDemoTrigger } from "./AdminControls";

describe("requestDemoTrigger", () => {
  it("선택 날짜와 도메인 경보 단계를 기존 트리거 API로 보낸다", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ data: { alerted: true, targetDate: "2026-08-22" } }),
    );

    await requestDemoTrigger(
      { date: "2026-08-22", level: AlertLevel.EMERGENCY },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledWith("/api/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetDate: "20260822",
        level: AlertLevel.EMERGENCY,
      }),
    });
  });

  it("트리거 API 오류 메시지를 사용자에게 전달한다", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        { error: { code: "NO_SUBJECTS", message: "대상자가 없습니다." } },
        { status: 409 },
      ),
    );

    await expect(
      requestDemoTrigger(
        { date: "2026-08-22", level: AlertLevel.WARNING },
        fetcher,
      ),
    ).rejects.toThrow("대상자가 없습니다.");
  });
});
```

- [ ] **Step 2: 기능 부재 실패 확인**

Run: `npm test -- src/components/admin/AdminControls.test.ts`

Expected: FAIL because `AdminControls`와 `requestDemoTrigger`가 존재하지 않는다.

- [ ] **Step 3: 요청 함수와 Client Component 구현**

`requestDemoTrigger`는 `fetch`를 기본 주입값으로 받고, non-2xx이면 `{ error: { message } }`를 읽어 `Error`를 던진다. `AdminControls`는 다음 두 동작만 소유한다.

```tsx
useEffect(() => {
  const timer = window.setInterval(() => router.refresh(), 10_000);
  return () => window.clearInterval(timer);
}, [router]);

async function submitDemoTrigger(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setPending(true);
  setMessage(null);
  try {
    await requestDemoTrigger({ date, level });
    setMessage("데모 경보를 발령했습니다.");
    router.refresh();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "데모 경보를 발령하지 못했습니다.");
  } finally {
    setPending(false);
  }
}
```

경보 단계 `<select>` 옵션의 value와 문구는 `AlertLevel`·`ALERT_LEVEL_LABEL`에서 만든다. 상태 메시지는 `role="status" aria-live="polite"`, 제출 버튼은 pending 중 disabled와 `발령 중…` 문구를 사용한다.

- [ ] **Step 4: 페이지에 컨트롤 연결**

상황 헤더에 마지막 갱신 시각과 `10초마다 자동 갱신` 문구를 표시한다. 데모 발령 패널은 실제 운영 트리거가 아니라는 설명과 함께 화면 하단에 둔다.

- [ ] **Step 5: 테스트와 lint 확인**

Run: `npm test -- src/components/admin/AdminControls.test.ts`

Expected: PASS, 2 tests.

Run: `npm run lint -- src/components/admin/AdminControls.tsx src/components/admin/AdminControls.test.ts`

Expected: 0 errors.

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/AdminControls.tsx src/components/admin/AdminControls.test.ts src/app/admin/page.tsx src/app/admin/admin.module.css
git commit -m "feat: 관리자 자동 갱신과 데모 발령을 연결한다"
```

---

### Task 5: 홈 진입점과 아키텍처 상태 갱신

**Files:**
- Create: `src/app/page.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: `/admin` 완성 상태
- Produces: 홈 관리자 링크, 현재 구현 상태 문서

- [ ] **Step 1: 홈 링크 실패 테스트 작성**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("관리자 관제 대시보드로 이동할 수 있다", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain('href="/admin"');
    expect(html).not.toContain("준비 중");
  });
});
```

- [ ] **Step 2: 현재 `준비 중` 때문에 실패하는지 확인**

Run: `npm test -- src/app/page.test.tsx`

Expected: FAIL because `/admin` href가 없고 `준비 중` 문구가 있다.

- [ ] **Step 3: 홈 링크와 문서 수정**

`src/app/page.tsx`의 관리자 `<div>`를 `/admin`으로 가는 `Link`로 바꾸고 `준비 중`을 제거한다. 기존 담당자 카드와 같은 접근 가능한 터치 영역을 유지한다.

`docs/architecture.md`에서 다음 상태를 현재 코드와 맞춘다.

- `src/app/admin/`: 구현됨
- `/admin`: 구현됨
- 카카오 지도: 건물별 오버레이 구현됨
- `/api/visit-queue`와 `/api/report`: 예정 상태 유지
- 알려진 문제의 방문 큐·출동 경로 미구현 항목: 유지

- [ ] **Step 4: 테스트와 diff 확인**

Run: `npm test -- src/app/page.test.tsx`

Expected: PASS, 1 test.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: 커밋**

```bash
git add src/app/page.tsx src/app/page.test.tsx docs/architecture.md
git commit -m "docs: 관리자 대시보드 진입점과 상태를 갱신한다"
```

---

### Task 6: 전체 검증과 화면 QA

**Files:**
- Modify only if verification exposes a defect: files introduced in Tasks 1–5

**Interfaces:**
- Consumes: completed `/admin` implementation
- Produces: test, lint, build, responsive and accessibility evidence

- [ ] **Step 1: 전체 자동 검증**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0 with no warnings attributable to this feature.

- [ ] **Step 2: Hallmark 사후 검사 자료 읽기**

Run:

```bash
sed -n '1,360p' /Users/byunghak/.agents/skills/hallmark/references/slop-test.md
sed -n '1,260p' /Users/byunghak/.agents/skills/hallmark/references/contract.md
```

Expected: 58개 slop-test 항목과 출력 계약을 현재 화면에 대조한다.

- [ ] **Step 3: 로컬 화면 검증**

Run: `npm run dev`

다음 상태를 브라우저에서 검증한다.

- `/`에서 `/admin` 이동
- 경보일 `/admin?date=2026-08-21`
- 비경보일 `/admin?date=2026-08-22`
- 담당자 필터 유지
- 카카오 키가 없을 때 지도 설정 안내와 우선순위 목록 동시 표시
- 데모 발령 후 요약·지도·목록 갱신

Viewport: 320×800, 375×812, 414×896, 768×1024, 1440×1000.

각 viewport에서 가로 스크롤 없음, 클릭 대상 44px 이상, 긴 주소 줄바꿈, 지도/목록 순서, focus ring을 확인한다.

- [ ] **Step 4: Hallmark 점수와 실패 항목 수정**

Philosophy, Hierarchy, Execution, Specificity, Restraint, Variety를 각각 1–5점으로 평가한다. 3점 미만 항목 또는 slop-test 실패가 있으면 관련 CSS/컴포넌트만 수정하고 Step 1과 Step 3을 다시 실행한다. 최종 CSS 스탬프에는 다음 줄을 추가한다.

```css
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R5 V4 */
```

실제 평가가 예시 점수와 다르면 검증 결과에 맞는 숫자로 기록한다.

- [ ] **Step 5: 최종 diff와 요구사항 감사**

Run:

```bash
git status --short
git diff --check
rg -n "준비 중" src/app/page.tsx docs/architecture.md
rg -n "TODO|TBD" src/app/admin src/components/admin src/lib/admin tokens.css
```

Expected:

- 의도한 파일만 변경
- whitespace 오류 없음
- 홈과 아키텍처에서 관리자 `준비 중` 제거
- 신규 구현에 TODO/TBD 없음
- 설계 문서의 자동·화면 완료 조건이 모두 증거로 확인됨

- [ ] **Step 6: 검증 수정 커밋**

검증에서 수정이 생긴 경우에만 실행한다.

```bash
git add src/app/admin src/components/admin src/lib/admin src/app/page.tsx src/app/globals.css tokens.css .hallmark docs/architecture.md
git commit -m "fix: 관리자 대시보드 검증 이슈를 정리한다"
```
