# Welfare Public Data Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production welfare scan successfully use the Korean Social Security Information Service Central Government Welfare Service API and report the API's real authentication error when access is denied.

**Architecture:** Keep the existing `refreshWelfarePrograms()` integration and exact official base URL. Complete the external API application for the existing public-data key, then make the XML boundary preserve the portal's error code before validating the deployed `GET` and `POST` routes.

**Tech Stack:** Next.js 16 Route Handlers, TypeScript, native `fetch`, Vitest, Vercel environment variables

**Spec:** `docs/PRD.md` FR-11, `docs/public-data-apis.md`, <https://www.data.go.kr/data/15090532/openapi.do>

## Global Constraints

- Do not change `https://apis.data.go.kr/B554287/NationalWelfareInformationsV001`; it is already the requested official API.
- Do not add a package, schema change, or ADR.
- Keep `PUBLIC_DATA_SERVICE_KEY` server-only; never expose it through `NEXT_PUBLIC_*`, logs, test fixtures, or response bodies.
- One utilization application must cover both `NationalWelfarelistV001` and `NationalWelfaredetailedV001`.
- Keep partial-failure behavior for AI/public-data independence; this plan changes diagnostics, not eligibility rules.

---

### Task 1: Complete API authorization outside the codebase

**Files:**
- No repository files

**Interfaces:**
- Consumes: existing Vercel `PUBLIC_DATA_SERVICE_KEY`
- Produces: an approved development-account authorization for dataset `15090532`

- [ ] **Step 1: Confirm the existing integration needs no endpoint replacement**

Verify `src/lib/public-data/welfare.ts` contains:

```ts
const WELFARE_API_BASE =
  "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001";
```

Expected: no code change.

- [ ] **Step 2: Apply for the exact public API**

Open <https://www.data.go.kr/data/15090532/openapi.do>, sign in, select `활용신청`, and request a development account for `한국사회보장정보원_중앙부처복지서비스`.

Expected: My Page shows `개발계정 승인`; the API is documented as auto-approved.

- [ ] **Step 3: Verify the credential association without exposing the key**

In the portal, confirm the approved application uses the same general authentication key represented by Vercel's `PUBLIC_DATA_SERVICE_KEY`. Do not copy the value into chat, issue text, or source control.

Expected: the approved application and Vercel environment variable refer to the same portal key.

- [ ] **Step 4: Change Vercel only if the key differs**

If the approved application uses a different general key, replace `PUBLIC_DATA_SERVICE_KEY` for Production and Preview and redeploy. If it is the same key, do not redeploy; retry after authorization propagation.

Expected: no credential is added to the repository.

### Task 2: Preserve the public portal's XML error code

**Files:**
- Modify: `src/lib/public-data/welfare.ts:69-94`
- Test: `src/lib/public-data/welfare.test.ts`

**Interfaces:**
- Consumes: an upstream `Response`, including non-2xx XML bodies
- Produces: `PublicDataError` with portal codes such as `30`, `20`, or `22`

- [ ] **Step 1: Write the failing test**

Add this test to `src/lib/public-data/welfare.test.ts`:

```ts
it("HTTP 403 XML의 공공데이터 인증 오류 코드를 보존한다", async () => {
  const fetcher: PublicDataFetch = async () => new Response(`
    <OpenAPI_ServiceResponse>
      <cmmMsgHeader>
        <errMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</errMsg>
        <returnAuthMsg>등록되지 않은 서비스키</returnAuthMsg>
        <returnReasonCode>30</returnReasonCode>
      </cmmMsgHeader>
    </OpenAPI_ServiceResponse>
  `, { status: 403 });

  await expect(
    refreshWelfarePrograms({ serviceKey: "test-key", fetcher }),
  ).rejects.toMatchObject({
    code: "30",
    message: "등록되지 않은 서비스키",
  });
});
```

- [ ] **Step 2: Run the test and confirm the current generic error**

Run:

```bash
npm test -- src/lib/public-data/welfare.test.ts
```

Expected: FAIL because the current implementation returns `UPSTREAM_HTTP_ERROR` and only `HTTP 403`.

- [ ] **Step 3: Read XML before checking `response.ok`**

Change `fetchXml()` to:

```ts
const xml = await response.text();
if (!response.ok) {
  assertSuccessfulXml(xml);
  throw new PublicDataError(
    `복지서비스 API가 HTTP ${response.status}로 응답했습니다.`,
    "UPSTREAM_HTTP_ERROR",
  );
}
assertSuccessfulXml(xml);
return xml;
```

This lets a structured portal error throw first while retaining the generic HTTP fallback for non-XML failures.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
npm test -- src/lib/public-data/welfare.test.ts src/app/api/welfare-scan/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the diagnostic fix**

```bash
git add src/lib/public-data/welfare.ts src/lib/public-data/welfare.test.ts
git commit -m "fix: preserve welfare API error codes"
```

### Task 3: Validate the real integration in production

**Files:**
- No repository files

**Interfaces:**
- Consumes: deployed `/api/welfare-scan`
- Produces: evidence that both the list and detail API operations succeed

- [ ] **Step 1: Verify program synchronization**

Run:

```bash
curl -sS https://this-house-first.vercel.app/api/welfare-scan | jq .
```

Expected: HTTP 200 with `data.count` greater than `0`.

- [ ] **Step 2: Verify the full scan**

Run:

```bash
curl -sS -X POST https://this-house-first.vercel.app/api/welfare-scan \
  | jq '.data | {programCount, partial, connections}'
```

Expected:

```json
{
  "programCount": 1,
  "partial": false,
  "connections": {
    "publicData": { "ok": true, "message": "공공데이터 연결 정상" },
    "ai": { "ok": true, "message": "AI 분석 연결 정상" }
  }
}
```

`programCount` may be greater than `1`; it must not be `0`.

- [ ] **Step 3: Classify any remaining portal error before changing code**

- Code `30`: verify the key and the dataset-specific utilization application.
- Code `20`: verify the application is approved and not suspended.
- Code `22`: the development quota is exhausted; wait for reset or request traffic expansion.

Do not add caching or retry logic unless production evidence shows code `22` after authorization succeeds.

## Self-Review

- The requested API URL is already present, so the plan does not replace working code.
- Authorization, hidden XML diagnostics, unit coverage, and production verification are each covered.
- No dependency, schema, eligibility-rule, or UI change is introduced.
