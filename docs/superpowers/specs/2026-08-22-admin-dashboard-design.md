# 관리자 관제 대시보드 설계

## 목표

전담사회복지사가 경보일에 담당 구역 전체를 한 화면에서 보고, **미확인 심각 가구를 먼저 찾아 그 수를 0으로 만드는** `/admin` 관제 대시보드를 구현한다.

이 문서는 PRD F5와 FR-6의 Must 범위를 구현 대상으로 삼는다. FR-7 방문 경로와 FR-9 일일 리포트는 독립 기능이므로 이번 범위에서 제외한다.

## 사용자와 핵심 행동

- 사용자: 여러 생활지원사와 담당 가구를 관리하는 전담사회복지사 또는 시군 복지과 관리자
- 핵심 행동: 미처리 심각 가구를 식별하고 담당자·대상자·현재 상태를 확인한다
- 화면 톤: 장식보다 정보 판독과 즉시 판단을 우선하는 `utilitarian`
- 북극성 표시: `미확인 심각` 수. 기존 `isOpenHouseholdStatus` 정의를 사용하며 별도 상태 해석을 만들지 않는다

## 범위

### 포함

- `/admin` 관리자 화면
- 경보 단계와 최고 체감온도 표시
- 미확인 심각·전체 미처리·방문 대기·오늘 처리 완료 요약
- 날짜·담당자 필터
- 건물 단위 카카오 지도 오버레이
- 건물별 최고 위험 단계와 가구 상태 표시
- 위험도 우선 대상자 목록
- 10초 폴링을 통한 상태 갱신
- 카카오 키 누락·지도 로드 실패 시 접근 가능한 목록 폴백
- 기존 `/api/trigger`를 재사용하는 데모용 수동 발령 패널
- 홈의 `준비 중` 안내를 실제 `/admin` 링크로 전환

### 제외

- 방문 경로 최적화 및 `/api/visit-queue`(FR-7)
- 일일 보고서 및 `/api/report`(FR-9)
- Web Push·SSE
- 관리자 인증·권한 시스템
- 새로운 npm 의존성
- Prisma 스키마 변경

## 설계 선택

### 선택: Server Component + 클라이언트 지도

`/admin` Server Component가 Prisma 집계 함수를 직접 호출한다. 지도와 자동 새로고침·수동 발령만 Client Component로 분리한다. 별도 `/api/admin`을 만들지 않는다.

이 방식은 현재 `/today`가 서버에서 보드 데이터를 읽는 구조와 일치하고, 클라이언트 데이터 캐시·로딩 상태·중복 API 계약을 만들지 않는다. 상태 갱신은 Client Component가 10초마다 `router.refresh()`를 호출해 Server Component 결과를 다시 받는다.

### 기각한 선택

- API 중심 SPA: 재사용할 소비자가 없는데 `/api/admin`과 클라이언트 fetch 상태를 함께 소유하게 된다
- 정적 스냅샷: 실시간 관제 요구와 승격 상태 반영을 충족하지 못한다
- 지도 SDK 래퍼 설치: 카카오 전역 SDK를 감싸기 위해 새 의존성을 추가할 필요가 없다

## 화면 구조

Hallmark 구조는 `Map / Diagram`, 장르는 `modern-minimal`, 테마는 기존 브랜드 색을 보존한 `Cobalt`로 한다. 지도 자체가 화면의 주 시각 요소이며 별도 장식 이미지는 사용하지 않는다.

1. 상단 내비게이션
   - 서비스명, `오늘의 대응 보드` 링크, 관리자 화면 표시
2. 상황 헤더
   - 선택 날짜, 경보 단계, 최고 체감온도, 마지막 갱신 시각
3. 요약 지표
   - 미확인 심각
   - 전체 미처리
   - 방문 대기
   - 오늘 처리 완료
4. 필터
   - 네이티브 `input[type=date]`
   - 담당자 `select`
   - GET 폼으로 URL 검색 파라미터 유지
5. 관제 본문
   - 데스크톱: 지도 2/3, 대상자 목록 1/3
   - 모바일: 지도 위, 목록 아래
   - 목록과 지도 상세에서 위험 단계를 표시할 때 스코어링 엔진의 `reasons`를 그대로 함께 표시
6. 상태 범례와 데이터 출처
7. 데모용 수동 발령 패널

## 데이터 계약

`src/lib/admin/dashboard.ts`가 다음 형태의 서버 전용 모델을 제공한다.

```ts
export type AdminStatusCategory =
  | "emergency"
  | "visit"
  | "unchecked"
  | "unreachable"
  | "called"
  | "resolved";

export interface AdminDashboardWorker {
  id: string;
  name: string;
}

export interface AdminDashboardSubject {
  subjectId: string;
  name: string;
  workerId: string;
  workerName: string;
  buildingId: string;
  address: string;
  lat: number;
  lng: number;
  grade: RiskGrade;
  score: number;
  reasons: string[];
  status: HouseholdStatus;
  statusLabel: string;
  open: boolean;
}

export interface AdminDashboardBuilding {
  buildingId: string;
  address: string;
  lat: number;
  lng: number;
  grade: RiskGrade;
  score: number;
  statusCategory: AdminStatusCategory;
  openCount: number;
  subjects: AdminDashboardSubject[];
}

interface AdminDashboardBase {
  date: string;
  dateLabel: string;
  selectedWorkerId: string | null;
  workers: AdminDashboardWorker[];
  generatedAt: string;
}

export interface AdminSilentDashboard extends AdminDashboardBase {
  alerted: false;
  subjects: [];
  buildings: [];
}

export interface AdminAlertedDashboard extends AdminDashboardBase {
  alerted: true;
  level: AlertLevel;
  levelLabel: string;
  feelsLikeMax: number;
  summary: {
    total: number;
    open: number;
    openCritical: number;
    visitQueued: number;
    completed: number;
  };
  subjects: AdminDashboardSubject[];
  buildings: AdminDashboardBuilding[];
}

export type AdminDashboard = AdminSilentDashboard | AdminAlertedDashboard;

export async function getAdminDashboard(options?: {
  date?: string;
  workerId?: string;
  now?: Date;
}): Promise<AdminDashboard>;
```

경보일에는 `AlertDay`를 기준으로 `RiskAssessment`, `HouseholdDayStatus`, `Subject`, `Building`, `Worker`를 읽는다. 비경보일에는 관리자·담당자 선택 정보와 빈 상황만 반환하며 위험 단계를 만들지 않는다.

담당자 목록은 `WorkerRole.WORKER`만 포함하고 이름 오름차순으로 정렬한다. `workerId`가 있으면 해당 담당자의 대상자만 집계하며, 존재하지 않는 값이면 다른 담당자의 데이터를 대신 보여주지 않고 빈 결과를 반환한다. `/admin`은 `date`가 유효한 ISO 날짜가 아니면 `notFound()`를 반환한다.

## 집계 규칙

### 요약

- `미확인 심각`: 위험 단계가 심각하면서 `isOpenHouseholdStatus(status)`가 참인 대상자 수
- `전체 미처리`: `isOpenHouseholdStatus(status)`가 참인 대상자 수
- `방문 대기`: 상태가 `HouseholdStatus.VISIT_QUEUED`인 대상자 수
- `오늘 처리 완료`: 전체 대상자 수 - 전체 미처리 수

### 대상자 정렬

1. 미처리 우선
2. 위험 단계 우선순위(심각 → 경계 → 주의; 내부 `grade` 값 1 → 2 → 3)
3. 점수 내림차순
4. 이름 오름차순

### 건물 집계

- 건물 위험 단계: 건물 내 대상자의 가장 높은 위험 단계
- 건물 점수: 건물 내 최고 점수
- 배지 숫자: 건물 내 미처리 대상자 수
- 지도 채움색: 위험 단계 색
- 지도 테두리색: 건물 내 가장 긴급한 상태 범주

상태 범주는 도메인 상태를 다시 명명하지 않고 시각화에만 사용한다.

| 상태 범주 | 도메인 상태 | 건물 표시 우선순위 |
|---|---|---:|
| emergency | `EMERGENCY_119` | 1 |
| visit | `VISITING`, `VISIT_QUEUED` | 2 |
| unchecked | `NO_ANSWER_1`, `UNCHECKED` | 3 |
| unreachable | `UNREACHABLE` | 4 |
| called | `CALL_OK` | 5 |
| resolved | `RESOLVED` | 6 |

건물 상세에서는 각 대상자의 원래 `HOUSEHOLD_STATUS_LABEL`을 그대로 표시한다.

## 카카오 지도

- `NEXT_PUBLIC_KAKAO_MAP_KEY`를 Server Component에서 읽어 `AdminMap`에 전달한다
- `AdminMap`은 카카오 JS SDK를 한 번만 로드하고 `autoload=false` 후 `kakao.maps.load`를 사용한다
- 모든 건물을 포함하도록 bounds를 확장한다
- 오버레이는 실제 DOM 요소로 만들고 키보드 포커스가 가능한 버튼으로 제공한다
- 클릭하면 같은 지도 영역 안에 건물 주소와 대상자별 위험 단계·상태·위험 사유를 표시한다
- 지도만으로 정보를 전달하지 않으며 동일 데이터를 우측 목록에서 항상 제공한다
- 키가 없거나 SDK가 실패하면 지도 영역에 원인을 표시하고 목록은 유지한다

## 수동 발령

수동 발령은 새 서버 로직을 만들지 않고 기존 `POST /api/trigger`를 호출한다.

- 입력: 선택 날짜, `ADVISORY | WARNING | EMERGENCY`
- 성공: 결과 메시지를 표시하고 `router.refresh()` 호출
- 실패: Route Handler가 돌려준 한국어 오류 메시지를 표시
- 버튼 문구에 `데모 발령`임을 명시해 실제 자동 발령과 혼동하지 않게 한다

## 오류·빈 상태

- 경보 없음: `오늘은 경보가 없습니다`와 데모 발령 패널을 표시하고 위험 지도는 만들지 않는다
- 담당자 필터 결과 없음: 선택한 담당자의 대상자가 없다는 빈 상태 표시
- 가구 상태 행 누락: 기존 보드와 동일하게 `UNCHECKED`로 해석
- 위험 사유 JSON 오류: `위험 사유를 불러오지 못했습니다`로 사실대로 표시
- 좌표 누락: 현재 스키마상 불가능하지만 비정상 숫자는 지도에서 제외하고 목록에는 남긴다
- 카카오 오류: 지도 전용 오류로 격리하며 서버 렌더링과 목록은 실패시키지 않는다

## 접근성·반응형

- 색 외에 텍스트·테두리·배지로 위험도와 상태를 중복 전달한다
- 모든 조작 요소는 최소 44×44px, `:focus-visible` 링을 제공한다
- 지도 오버레이와 필터에 접근 가능한 이름을 부여한다
- 320·375·414·768px에서 가로 스크롤이 없어야 한다
- 데스크톱 1280px 이상에서는 지도와 목록을 나란히 배치한다
- `prefers-reduced-motion`에서는 상태 변화에 공간 이동 애니메이션을 사용하지 않는다

## 스타일 원칙

- 기존 `globals.css`의 한국어 폰트와 위험 단계 색 의미를 보존한다
- 관리자 전용 토큰은 루트 `tokens.css`에 `--admin-*` 이름으로 둔다
- 페이지 스타일은 `admin.module.css`에 격리한다
- 원시 색상은 토큰 파일에서만 정의하고 컴포넌트에서는 토큰 이름만 사용한다
- 지도 마커도 CSS Module 클래스와 토큰을 사용한다
- 새 아이콘 라이브러리를 설치하지 않는다

## 테스트와 완료 조건

### 자동 검증

- 집계 순수 함수 테스트
  - 미확인 심각 계산
  - 누락 상태의 `UNCHECKED` 폴백
  - 대상자 우선순위 정렬
  - 동일 건물의 최고 위험 단계·상태 범주 집계
  - 담당자 필터
- `npm test`
- `npm run lint`
- `npm run build`

### 화면 검증

- `/admin`이 더 이상 `준비 중`이 아니며 홈에서 이동 가능
- 경보일에 요약·지도·대상자 목록이 같은 수치를 표시
- 비경보일 빈 상태가 오류 없이 표시
- 카카오 키가 없어도 대상자 목록과 요약이 표시
- 데모 발령 후 새 경보일 상태가 화면에 반영
- 320·375·414·768px와 데스크톱에서 레이아웃 검증
- 키보드만으로 필터·발령·건물 선택 가능

## 예상 변경 파일

생성:

- `src/lib/admin/dashboard.ts`
- `src/lib/admin/dashboard.test.ts`
- `src/app/admin/page.tsx`
- `src/app/admin/admin.module.css`
- `src/components/admin/AdminMap.tsx`
- `src/components/admin/AdminControls.tsx`
- `tokens.css`
- `.hallmark/preflight.json`
- `.hallmark/log.json`

수정:

- `src/app/globals.css`
- `src/app/page.tsx`
- `docs/architecture.md`

삭제 파일은 없다.

## 2026-08-22 레퍼런스 동기화 부록

기준 이미지는 `/Users/byunghak/.codex/attachments/9503756b-628c-476b-b0de-a602a033662d/image-1.png`(1672×941px)이다. 이 부록은 위의 초기 화면 구조 중 시각 구성과 에셋 방침을 최신 레퍼런스에 맞게 구체화한다.

- 상단 상황바 72px, 등록 작업줄 56px, 좌우 여백 24px, 좌측 사이드바 208px, 본문 간격 16px.
- 관제 콘텐츠는 요약 104px, 지도 324px, 관리 표 328px이며 행 간격은 12px.
- 지도 행은 지도 약 1060px와 건물 현황 약 332px를 8px 간격으로 배치한다.
- 관리 행은 대상자 표 약 926px와 생활지원사 표 약 450px를 24px 간격으로 배치한다.
- 시각 토큰은 옅은 청회색 캔버스, 흰 패널, 저대비 회청색 선, 코발트 보라 강조, 빨강 위험, 주황 경고, 파랑·초록 완료다. 패널 반경은 약 12px다.
- 브랜드, 상단 메타, 요약 지표, 상태, 건물, 검색, 추가, 합성 인물, 지도 폴백은 `public/admin/`의 생성 PNG를 사용한다. 이모지·CSS 그림·인라인 SVG로 대체하지 않는다.
- 지도 API 키가 없을 때도 생성 지도 위 건물 선택과 상세 갱신이 작동해야 한다.
- 같은 1672×941 상태로 원본과 구현을 한 이미지에서 비교하고, `design-qa.md`의 마지막 줄이 정확히 `final result: passed`일 때만 시각 구현을 완료로 판정한다.
