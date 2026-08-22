# 현재 날씨 표시 설계

## 목표

기상청 초단기실황에서 현재 기온과 습도를 받아 여름철 체감온도를 계산하고, 관리자 웹과 생활지원사 웹에 10분 단위로 같은 값을 표시한다.

현재 관측값은 위험도 판정에 쓰는 `AlertDay.feelsLikeMax`와 분리한다. `AlertDay`는 익일 최고 체감온도 기반 운영 스냅샷이고, 이번 기능은 사용자가 지금 상황을 이해하기 위한 읽기 전용 표시다.

## 범위

### 포함

- 기상청 `getUltraSrtNcst` 초단기실황 조회
- `T1H` 현재 기온과 `REH` 현재 습도 파싱
- 기존 여름철 체감온도 계산 함수 재사용
- Next 서버 데이터 캐시 600초
- `/api/public-data/current-weather` 서버 프록시
- 관리자 `/admin`과 공용 관리자 관리 헤더 표시
- 생활지원사 `/today` 표시
- 경보일·비경보일 모두 표시
- 최초 조회 실패 시 화면 전체를 막지 않는 오류 상태
- 관측시각과 기상청 출처 표시

### 제외

- `AlertDay` 또는 위험점수 재계산
- Prisma 스키마 변경과 날씨 이력 저장
- 한파 체감온도 산식
- 다지역·담당자별 서로 다른 기상 격자
- 새 npm 의존성

## 선택한 접근

기존 `src/lib/public-data/kma.ts`와 공공데이터 공통 클라이언트를 확장한다. 브라우저는 새 Route Handler만 호출하며 공공데이터 서비스키를 보지 않는다. Route Handler가 사용하는 기상청 fetch에 `next.revalidate = 600`을 적용해 관리자와 생활지원사 요청이 같은 서버 캐시를 공유한다.

DB 스냅샷은 만들지 않는다. 현재 요구는 표시와 10분 캐시이며, 관측 이력·감사·장기 통계가 없으므로 마이그레이션과 중복 갱신 잠금은 불필요하다.

## 공공 API

- 서비스: 기상청 단기예보 조회서비스 2.0
- 작업: 초단기실황조회
- URL: `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst`
- 인증: 기존 `PUBLIC_DATA_SERVICE_KEY`
- 위치: `KMA_GRID_NX`, `KMA_GRID_NY` 서버 환경변수
- 캐시: 600초

초단기실황은 매시 정각 기준 자료다. 자료 게시 지연을 피하기 위해 KST 분이 10 이상이면 현재 시각의 정시, 10 미만이면 이전 정시를 요청한다. 자정 직후에는 날짜도 전날로 이동한다.

## 데이터 계약

```ts
export interface CurrentWeather {
  source: "기상청 초단기실황 조회서비스";
  grid: { nx: number; ny: number };
  observedAt: string;
  fetchedAt: string;
  temperature: number;
  humidity: number;
  feelsLikeTemperature: number;
}

export interface ObservationBase {
  baseDate: string;
  baseTime: string;
}

export function resolveObservationBase(now?: Date): ObservationBase;

export async function getCurrentWeather(
  params: { nx: number; ny: number; baseDate?: string; baseTime?: string },
  options?: { serviceKey?: string; fetcher?: PublicDataFetch; now?: Date },
): Promise<CurrentWeather>;
```

`observedAt`과 `fetchedAt`은 ISO 8601 문자열이다. `temperature`와 `humidity`는 기상청 값을 보존하고 `feelsLikeTemperature`만 기존 함수대로 소수 첫째 자리로 반올림한다.

## API 계약

`GET /api/public-data/current-weather`

성공:

```json
{
  "data": {
    "source": "기상청 초단기실황 조회서비스",
    "grid": { "nx": 102, "ny": 94 },
    "observedAt": "2026-08-22T14:00:00+09:00",
    "fetchedAt": "2026-08-22T14:12:00.000Z",
    "temperature": 31.2,
    "humidity": 68,
    "feelsLikeTemperature": 33.8
  }
}
```

`KMA_GRID_NX`·`KMA_GRID_NY`가 없거나 1~3자리 정수가 아니면 `503 MISSING_WEATHER_GRID`, 서비스키가 없으면 기존 `503 MISSING_SERVICE_KEY`, 기상청 응답에 `T1H` 또는 `REH`가 없으면 `502 INVALID_UPSTREAM_RESPONSE`를 반환한다.

## UI

공용 `CurrentWeatherSummary` Client Component가 Route Handler를 호출한다. 마운트 시 한 번 조회하고 10분마다 다시 요청한다. 브라우저 요청은 Route Handler로만 가며 공공데이터포털을 직접 호출하지 않는다.

- 생활지원사 `/today`: 인사말 아래, 경보 배너 위에 현재 기온·현재 체감온도·관측시각을 큰 글자로 표시한다.
- 관리자 `/admin`: 상단 메타에 현재 기온·현재 체감온도를 표시한다. 기존 `최고 체감온도`는 경보일에만 별도 유지한다.
- 관리자 상세·등록 공용 헤더: 현재 날씨 요약을 사용하고 고정 `14:32`를 제거한다. 데이터가 없는 신규 등록 화면의 고정 날짜 `2026-08-22`는 현재 KST 날짜로 바꾼다.

로딩 중에는 고정 높이의 `날씨 확인 중`을, 실패하면 `현재 날씨를 불러오지 못했습니다`를 표시한다. 실패해도 대상자 목록, 위험도, 확인 기록 기능은 그대로 렌더링한다.

## 테스트

- 관측 기준시각: 14:09 → 13:00, 14:10 → 14:00, 00:05 → 전날 23:00
- KMA `T1H`·`REH` 파싱과 체감온도 계산
- 공공데이터 fetch가 `next.revalidate = 600`을 받는지 검증
- 환경변수 누락과 잘못된 격자좌표의 503 응답
- 공용 컴포넌트의 성공·로딩·실패 문구
- 관리자와 생활지원사 화면에 공용 컴포넌트가 포함되는지 검증

## 운영 설정

`.env.example`과 배포 문서에 다음 값을 추가한다.

```dotenv
KMA_GRID_NX=""
KMA_GRID_NY=""
```

값은 시연 지역의 기상청 5km 격자좌표를 사용한다. 이번 기능은 단일 담당 지역 MVP이므로 좌표 자동 변환이나 DB 저장은 추가하지 않는다.
