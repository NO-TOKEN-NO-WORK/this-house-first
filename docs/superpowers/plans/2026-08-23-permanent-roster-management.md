# Permanent Roster Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep active care-worker and subject rosters manageable on every date while preserving alert-day snapshots and history when records are archived.

**Architecture:** `Worker`, `Subject`, and `Building` remain the permanent roster. Nullable `archivedAt` fields define current membership; the admin read model always returns the active roster and adds alert-day assessment/status data only when an `AlertDay` exists.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7 + PostgreSQL, Vitest

**Spec:** `docs/superpowers/specs/2026-08-23-permanent-roster-management-design.md`

## Global Constraints

- Do not introduce a new library, storage system, `CareDay`, or `SubjectDay`.
- Preserve existing `AlertDay`, `RiskAssessment`, `HouseholdDayStatus`, `CheckEvent`, and `Notification` rows.
- Current roster queries and new alert declarations include only rows with `archivedAt = null`.
- Historical detail queries may still resolve archived workers and subjects.
- User-facing risk reasons remain the scoring engine's original `reasons` strings.
- State values continue to use `src/lib/domain.ts` constants.
- Read the relevant Next.js 16 guide under `node_modules/next/dist/docs/` before changing App Router code.

---

### Task 1: Add non-destructive roster archiving to Prisma

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260823090000_add_roster_archiving/migration.sql`
- Create: `docs/adr/0021-permanent-roster-alert-snapshot-separation.md`
- Modify: `docs/adr/README.md`

**Interfaces:**
- Produces: `Worker.archivedAt: Date | null` and `Subject.archivedAt: Date | null` in generated Prisma Client.
- Preserves: all existing rows as active because the new columns default to `NULL`.

- [ ] **Step 1: Add nullable fields and indexes to the Prisma schema**

```prisma
model Worker {
  archivedAt DateTime?

  @@index([role, archivedAt])
}

model Subject {
  archivedAt DateTime?

  @@index([workerId, archivedAt])
}
```

- [ ] **Step 2: Add a data-preserving SQL migration**

```sql
ALTER TABLE "Worker" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Subject" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Worker_role_archivedAt_idx" ON "Worker"("role", "archivedAt");
CREATE INDEX "Subject_workerId_archivedAt_idx" ON "Subject"("workerId", "archivedAt");
```

- [ ] **Step 3: Record the architecture decision**

Document the permanent-roster/alert-snapshot boundary, soft archive behavior, rejected `CareDay` option, and non-destructive migration in ADR-0021; add it to the ADR index.

- [ ] **Step 4: Validate and generate**

Run:

```bash
npx prisma validate
npx prisma generate
```

Expected: both commands exit 0 without changing existing migrations.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260823090000_add_roster_archiving docs/adr/0021-permanent-roster-alert-snapshot-separation.md docs/adr/README.md
git commit -m "feat: 상시 원장 보관 필드를 추가한다"
```

### Task 2: Return the active roster independently of alert snapshots

**Files:**
- Modify: `src/lib/admin/dashboard.test.ts`
- Modify: `src/lib/admin/dashboard.ts`

**Interfaces:**
- Produces: `AdminDashboardBase.roster` containing `workers` and `subjects` on both alerted and silent dates.
- Preserves: `AdminAlertedDashboard.subjects` as the alert snapshot consumed by the map and summary.

- [ ] **Step 1: Write failing roster tests**

Add tests proving:

```ts
expect(buildAdminRoster({ workers, subjects }).subjects).toHaveLength(2);
expect(buildAdminRoster({ workers, subjects, workerId: "missing" }).subjects).toEqual([]);
expect(buildAdminRoster({ workers, subjects, subjectQuery: "박" }).subjects.map((row) => row.name)).toEqual(["박○○"]);
```

The fixtures must contain active rows only; Prisma filtering is tested by inspecting the mocked `getAdminDashboard()` calls.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npm test -- src/lib/admin/dashboard.test.ts
```

Expected: failure because `buildAdminRoster` and `dashboard.roster` do not exist.

- [ ] **Step 3: Implement the minimal roster model and query**

Add `AdminRosterWorker`, `AdminRosterSubject`, and:

```ts
export interface AdminRoster {
  workers: AdminRosterWorker[];
  subjects: AdminRosterSubject[];
}
```

Query active workers and active subjects regardless of `AlertDay`:

```ts
where: { role: WorkerRole.WORKER, archivedAt: null }
where: { archivedAt: null, worker: { archivedAt: null } }
```

Return `roster` from the base object before the `if (!alertDay)` branch. Keep alert snapshot queries date-scoped.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/lib/admin/dashboard.test.ts
```

Expected: all dashboard tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/dashboard.ts src/lib/admin/dashboard.test.ts
git commit -m "fix: 관리자 조회에서 상시 원장을 분리한다"
```

### Task 3: Keep management UI visible on non-alert dates

**Files:**
- Modify: `src/app/admin/page.test.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `dashboard.roster` from Task 2.
- Produces: management rows where risk fields are present only when a matching alert snapshot exists.

- [ ] **Step 1: Write failing page tests**

Render a silent dashboard with one roster worker and one roster subject, then assert:

```ts
expect(html).toContain("대상자 관리");
expect(html).toContain("생활지원사 관리");
expect(html).toContain("비경보일 대상자");
expect(html).toContain("경보 없음");
expect(html).not.toContain("오늘의 관제 요약");
```

- [ ] **Step 2: Run the page test and verify RED**

```bash
npm test -- src/app/admin/page.test.tsx
```

Expected: management labels and roster subject are absent on the silent branch.

- [ ] **Step 3: Render management outside the alert conditional**

Join `dashboard.roster.subjects` with alerted `dashboard.subjects` by `subjectId`. Render all roster subjects; use `경보 없음` for missing grade, status, and reasons. Keep summary/map/building panels inside `dashboard.alerted`.

Change `WorkerPanel` to consume roster workers directly instead of requiring `AdminAlertedDashboard`.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/app/admin/page.test.tsx
```

Expected: all admin page tests pass, including the silent roster case.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/page.test.tsx
git commit -m "fix: 비경보일에도 원장 관리를 표시한다"
```

### Task 4: Replace destructive deletion with archive actions

**Files:**
- Create: `src/app/admin/actions.test.ts`
- Modify: `src/app/admin/actions.ts`
- Modify: `src/app/admin/subjects/[subjectId]/page.tsx`
- Modify: `src/app/admin/subjects/[subjectId]/edit/page.tsx`
- Modify: `src/app/admin/workers/[workerId]/edit/page.tsx`

**Interfaces:**
- Produces: `archiveSubject(subjectId)` and `archiveWorker(workerId)` server actions.
- Removes: physical deletion of alert history from normal admin flows.

- [ ] **Step 1: Write failing server-action tests**

Mock Prisma and Next navigation/cache boundaries, then verify:

```ts
expect(prisma.subject.update).toHaveBeenCalledWith({
  where: { id: "subject-1", archivedAt: null },
  data: { archivedAt: expect.any(Date) },
});
expect(prisma.riskAssessment.deleteMany).not.toHaveBeenCalled();
expect(prisma.checkEvent.deleteMany).not.toHaveBeenCalled();
```

Also prove `archiveWorker` rejects an active worker with active subjects and permits one with zero active subjects even when historical checks exist.

- [ ] **Step 2: Run the action test and verify RED**

```bash
npm test -- src/app/admin/actions.test.ts
```

Expected: failure because archive actions do not exist and current deletion calls `deleteMany`.

- [ ] **Step 3: Implement archive actions and update call sites**

Use `update` with `{ id, archivedAt: null }`; translate Prisma not-found failures into explicit Korean errors. Count only subjects with `archivedAt: null` before archiving a worker. Rename UI-bound actions from `delete*` to `archive*`, keeping the existing confirmation surfaces.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/app/admin/actions.test.ts
```

Expected: all archive tests pass and no history deletion is invoked.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/actions.test.ts src/app/admin/subjects src/app/admin/workers
git commit -m "fix: 원장 삭제를 보관 처리로 바꾼다"
```

### Task 5: Exclude archived rows from current operations

**Files:**
- Modify: `src/lib/board/today.ts`
- Modify: `src/lib/admin/subject-detail.ts`
- Modify: `src/lib/admin/worker-detail.ts`
- Modify: `src/lib/trigger/declare.ts`
- Modify: `src/app/api/checks/route.ts`
- Modify: `src/lib/notifications/read.ts`
- Modify: relevant existing `*.test.ts` files next to these modules

**Interfaces:**
- Current operations consume only `archivedAt: null` workers/subjects.
- Historical subject and worker detail lookup by explicit ID remains unfiltered.

- [ ] **Step 1: Add failing regression assertions**

Assert that current roster, trigger inputs, default manager selection, and new checks require `archivedAt: null`. Assert that explicit historical detail builders still accept archived fixture rows.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npm test -- src/lib/board src/lib/trigger src/lib/admin src/app/api/checks src/lib/notifications
```

Expected: query-shape assertions fail because archived filters are absent.

- [ ] **Step 3: Add active filters at current-operation boundaries**

- Default worker and silent roster: active worker and active subjects only.
- Trigger declaration: active subjects only; active managers only.
- Check creation: reject an archived subject or worker.
- Subject creation options and worker current detail list: active rows only.
- Notification feed default manager: active manager only.
- Explicit subject/worker detail by ID: retain historical access.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/lib/board src/lib/trigger src/lib/admin src/app/api/checks src/lib/notifications
```

Expected: focused suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib src/app/api
git commit -m "fix: 현재 업무에서 보관 원장을 제외한다"
```

### Task 6: Update architecture and complete verification

**Files:**
- Modify: `docs/architecture.md`

**Interfaces:**
- Documents: permanent roster availability, archive semantics, and unchanged alert-day snapshots.

- [ ] **Step 1: Update architecture snapshot and known issue**

Replace the statement that non-alert days cannot retain roster management with the permanent roster/optional alert snapshot model. Keep non-alert check recording documented as unsupported.

- [ ] **Step 2: Run formatting and database checks**

```bash
npx prisma format
npx prisma validate
npx prisma generate
```

Expected: schema formats cleanly, validates, and client generation succeeds.

- [ ] **Step 3: Run full project verification**

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: every command exits 0 with no warnings introduced by this change.

- [ ] **Step 4: Commit documentation and formatting**

```bash
git add docs/architecture.md prisma/schema.prisma
git commit -m "docs: 상시 원장 구조를 반영한다"
```

### Task 7: Publish, review, and merge

**Files:** No repository files unless review finds a defect.

- [ ] **Step 1: Push the feature branch**

```bash
git push -u origin codex/permanent-roster-management
```

- [ ] **Step 2: Create the PR**

Create a Korean PR description covering the root cause, schema migration, archive behavior, domain-rule checklist, and verification commands.

- [ ] **Step 3: Wait for required checks and review the diff**

Use `gh pr checks --watch` and inspect the complete PR diff. Fix only merge-blocking findings, rerunning the relevant checks.

- [ ] **Step 4: Merge to main**

```bash
gh pr merge --squash --delete-branch
```

Expected: PR reports `MERGED`, required checks pass, and remote `main` contains the squash commit.

