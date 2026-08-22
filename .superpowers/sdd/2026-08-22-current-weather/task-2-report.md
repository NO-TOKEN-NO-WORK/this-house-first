# Task 2 report: 현재 날씨 Route Handler

## Implementation

- Added `GET /api/public-data/current-weather`.
- Reads `KMA_GRID_NX` and `KMA_GRID_NY` only on the server and validates each as a 1–3 digit integer.
- Missing or invalid grid settings return `503 MISSING_WEATHER_GRID` through `toPublicDataErrorResponse()`.
- Valid coordinates are converted to numbers and passed to `getCurrentWeather({ nx, ny })`; the result is returned as `{ data }`.
- Added server-only `KMA_GRID_NX` and `KMA_GRID_NY` entries to `.env.example`.

## TDD evidence

- RED: `npm test -- src/app/api/public-data/current-weather/route.test.ts` failed because the route module did not exist (`Cannot find module .../current-weather/route`; 0 tests ran).
- GREEN: the same command passed with 4/4 tests.
- Final full suite: `npm test` passed (51 files, 257 tests).
- `npm run lint` passed.
- `git diff --check` passed.

## Files

- `.env.example`
- `src/app/api/public-data/current-weather/route.ts`
- `src/app/api/public-data/current-weather/route.test.ts`

## Concerns / main-thread recheck

- `npm run build` compiled the route and completed TypeScript, but page-data collection is blocked by the existing missing `DATABASE_URL` while loading `/api/visit-queue`.
