# 관리자 대시보드 레퍼런스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 첨부한 1672×941 관리자 관제 레퍼런스를 기존 `/admin` 기능과 실제 데이터로 재현한다.

**Architecture:** 기존 Server Component가 Prisma 데이터를 읽고 `AdminMap`과 `AdminControls`만 Client Component로 유지한다. 새 API·스키마·의존성 없이 기존 대시보드 모델에 이미 DB에 있는 대상자·담당자 필드를 보강하고, 한 화면 관제 워크벤치 마크업과 CSS Module을 교체한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, CSS Modules, Prisma Postgres, Vitest, Kakao Maps SDK

**Spec:** `/Users/byunghak/.codex/attachments/9503756b-628c-476b-b0de-a602a033662d/image-1.png`, `docs/PRD.md` F5, `docs/superpowers/specs/2026-08-22-admin-dashboard-design.md`

## Global Constraints

- 상태·경보·등급 문구는 `src/lib/domain.ts` 상수만 사용한다.
- 위험 사유는 스코어링 엔진의 `reasons`를 그대로 표시한다.
- 합성 인물만 사용하고 실제 개인정보를 만들지 않는다.
- 새 라이브러리·Prisma 스키마·API·라우트를 추가하지 않는다.
- 현재 GET 필터, 10초 갱신, 데모 발령, 카카오 지도 폴백을 보존한다.
- 레퍼런스 기준 뷰포트는 1672×941이며 320·375·414·768px에서도 가로 스크롤 없이 사용 가능해야 한다.

---

### Task 1: 관리자 화면 데이터 계약 보강

**Files:**
- Modify: `src/lib/admin/dashboard.ts`
- Test: `src/lib/admin/dashboard.test.ts`

**Interfaces:**
- Consumes: Prisma `Worker.phone`, `Subject.birthYear`, `Subject.phone`, 개인·건물 위험 필드
- Produces: `AdminDashboardSubject.phone`, `AdminDashboardSubject.birthYear`, `AdminDashboardSubject.workerPhone`; 담당자 수는 현재 대상자 목록에서 계산

- [x] **Step 1: 누락된 실제 필드와 담당자별 대상자 수를 검증하는 실패 테스트 작성**
- [x] **Step 2: `npm test -- src/lib/admin/dashboard.test.ts`로 기대한 실패 확인**
- [x] **Step 3: 기존 조회 결과에서 필드를 전달하고 선택된 평가 목록으로 담당자별 수를 계산**
- [x] **Step 4: 같은 테스트를 다시 실행해 통과 확인**

### Task 2: 레퍼런스 관제 워크벤치 구현

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/page.test.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `src/components/admin/AdminControls.tsx`
- Modify: `src/components/admin/AdminControls.test.ts`
- Modify: `src/components/admin/AdminMap.tsx`
- Modify: `tokens.css`
- Add: `public/admin/brand-mark.png`
- Add: `public/admin/elder-*.png`

**Interfaces:**
- Consumes: Task 1의 확장된 `AdminDashboard`, 기존 `AdminMap`, 기존 `/api/trigger`
- Produces: 상단 상황바, 좌측 필터, 요약 지표, 지도와 건물 현황, 대상자·생활지원사 테이블, 대상자 상세 카드

- [x] **Step 1: 주요 landmark·도메인 문구·관리 테이블을 검증하는 실패 테스트 작성**
- [x] **Step 2: `npm test -- src/app/admin/page.test.tsx src/components/admin/AdminControls.test.ts`로 실패 확인**
- [x] **Step 3: 기존 기능을 새 워크벤치 마크업으로 재배치하고 레퍼런스 토큰으로 CSS 교체**
- [x] **Step 4: 데모 발령 3단계 버튼, 필터, 지도 선택, 상세 링크의 상호작용 보존**
- [x] **Step 5: 대상자 프로필과 브랜드 래스터 자산 배치**
- [x] **Step 6: 관련 테스트를 다시 실행해 통과 확인**

### Task 3: 렌더링 비교와 완료 검증

**Files:**
- Create: `design-qa.md`
- Create: `.artifacts/admin-dashboard-implementation.png`
- Create: `.artifacts/admin-dashboard-comparison.png`

**Interfaces:**
- Consumes: 1672×941 레퍼런스와 브라우저 렌더링 캡처
- Produces: `final result: passed`인 시각 QA 보고서

- [x] **Step 1: 로컬 앱을 실행하고 `/admin`을 1672×941로 캡처**
- [x] **Step 2: 레퍼런스와 캡처를 같은 비교 이미지에 배치해 P0/P1/P2 차이 기록**
- [x] **Step 3: 차이를 수정하고 동일 상태로 재캡처해 `design-qa.md`가 통과할 때까지 반복**
- [x] **Step 4: 320·375·414·768px 반응형과 핵심 필터·발령·지도 선택 동작 확인**
- [x] **Step 5: `npm run lint`, `npm test`, `npm run build`를 새로 실행하고 결과 확인**
