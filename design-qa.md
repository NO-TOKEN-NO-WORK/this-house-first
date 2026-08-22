# Design QA — 관리자 대상자 상세·수정

## 비교 대상

- Source visual truth
  - 상세: `/var/folders/nj/p0_b3g6d0y73t8t3dy_7cwhh0000gn/T/codex-clipboard-ae475313-3ca4-4528-9ada-3b584a24136b.png`
  - 수정: `/var/folders/nj/p0_b3g6d0y73t8t3dy_7cwhh0000gn/T/codex-clipboard-bef38135-3f23-49a0-b2d3-6ce07d9835c6.png`
- Implementation screenshots
  - 상세: `/Users/byunghak/.codex/visualizations/2026/08/22/01a0289b-3e02-7a93-b5b1-58f764c2fc98/admin-detail-final.png`
  - 수정: `/Users/byunghak/.codex/visualizations/2026/08/22/01a0289b-3e02-7a93-b5b1-58f764c2fc98/admin-edit-final.png`
- Full-view comparison evidence
  - 상세: `/Users/byunghak/.codex/visualizations/2026/08/22/01a0289b-3e02-7a93-b5b1-58f764c2fc98/detail-comparison-final.png`
  - 수정: `/Users/byunghak/.codex/visualizations/2026/08/22/01a0289b-3e02-7a93-b5b1-58f764c2fc98/edit-comparison-final.png`
  - 문자열 레이아웃 재검증: `/Users/byunghak/.codex/visualizations/2026/08/22/01a0289b-3e02-7a93-b5b1-58f764c2fc98/edit-overflow-comparison.png`
- State: 심각 경보일, 위험 단계가 심각하고 방문 대기인 대상자의 상세 및 수정 화면.
- Source pixels: 상세·수정 모두 `1672 × 941`.
- Implementation pixels / viewport: Arc 전체 화면 `1224 × 768`, DPR 1 캡처. 브라우저 상단 크롬을 포함한다.
- Normalization: 두 화면을 한 비교 보드에서 동일 열 너비로 비율 유지 축소했다. 원본과 현재 Arc 창의 물리 폭이 달라 픽셀 단위 판정은 하지 않고, 데스크톱 반응형 구조·비율·위계·상태를 비교했다.

## Findings

- 남은 P0/P1/P2 없음.
- [P3] 원본은 생년월일·비상 연락처 등 현재 Prisma 스키마에 없는 항목을 포함한다. 구현은 값을 꾸며내지 않고 `생년` 또는 `미등록`으로 명확히 표시하고, 저장 가능한 기존 필드만 폼에 연결했다.

## 필수 충실도 점검

- Fonts and typography: 기존 프로젝트의 관리자 글꼴·굵기 체계를 재사용했고, 제목/라벨/본문 위계와 작은 표 글자의 가독성을 유지했다. 잘림이나 겹침 없음.
- Spacing and layout rhythm: 상세 화면의 상단 프로필, 3개 정보 카드, 점검 이력, 우측 빠른 실행/담당자/지도 레일을 시안 순서와 비율로 재현했다. 수정 화면도 ① 기본 정보, ② 위험/관제, ③ 설비 점검, 우측 요약 레일을 유지했다.
- Colors and tokens: 기존 `--admin-*` 토큰과 전역 위험 단계 Semantic 토큰만 사용했다. 보라색 주요 동작, 빨간 위험 상태, 주황 점검 상태가 시안과 같은 역할을 한다.
- Image quality and assets: 기존 관리자 브랜드, 합성 프로필, 지도, 상태 아이콘 원본 자산을 사용했다. CSS/문자/인라인 SVG 대체 없음. 이미지 비율 경고도 제거했다.
- Copy and content: 위험 사유는 스코어링 결과를 그대로 표시한다. 없는 DB 값은 생성하지 않는다.
- Accessibility and behavior: 의미 있는 링크·버튼·레이블·대체 텍스트를 유지했다. 검색, 상태 필터, 마커 선택, 상세/수정 이동을 Arc에서 확인했다.

## Focused region evidence

- 전체 비교에서 작게 보이는 위험 사유·생년·점검 시각은 Arc 접근성 트리와 개별 `1224 × 768` 캡처로 확대 확인했다.
- 상세: `1938년 (88세)`, `2026.08.22 18:05`, 스코어링 위험 사유가 잘림 없이 표시됨.
- 수정: 저장/삭제 동작, 입력 필드, 냉방기 라디오 상태, 우측 요약과 지도 카드가 표시됨.

## Comparison history

1. 최초 비교
   - [P2] 생년이 `1938-미등록-미등록`으로 노출됨.
   - [P2] 점검 시각의 날짜와 시간이 마침표로 붙음.
   - [P2] 참조 대상과 프로필 이미지 성별이 다르고, Next Image 비율 경고가 발생함.
2. 수정
   - 생년을 `1938년 (88세)`로 변경.
   - 점검 시각을 `2026.08.22 18:05`로 정규화.
   - 참조와 같은 여성 합성 프로필 자산을 사용하고 이미지 폭·높이를 함께 고정.
3. 재비교
   - `detail-comparison-final.png`, `edit-comparison-final.png`에서 위 항목이 해소됨.
   - Arc 기능 QA와 개발 서버 로그에서 렌더 오류 및 이미지 경고 없음.
4. 문자열 레이아웃 재검증
   - 좁은 설비 점검 그리드에서 라디오 라벨이 글자 단위로 꺾이는 현상을 재현하고, 항목 수축을 막아 한 줄 레이블로 복원함.
   - 위험 사유·주소·최근 점검 요약은 박스 폭에 맞춰 줄바꿈하며, 중간 폭 헤더는 부가 메타 정보를 숨겨 겹침 없이 유지함.

## Implementation checklist

- [x] 상세 화면 구조 및 주요 동작
- [x] 수정 화면 구조 및 저장 동작
- [x] 지도 왼쪽 고정 선택 대상자 패널
- [x] 대상자 검색 및 상태 필터
- [x] 반응형 레이아웃과 이미지 자산
- [x] Arc 브라우저 기능 QA

final result: passed

---

# Design QA — 관리자 복지 스캔

## 비교 대상

- Source visual truth: `/var/folders/nj/p0_b3g6d0y73t8t3dy_7cwhh0000gn/T/codex-clipboard-6001cbce-a595-468c-9b48-c750b7dbb9a6.png`
- Implementation screenshots:
  - `docs/design-qa/welfare-scan-1440.jpg` — 상세 드로어가 열린 상태, `1440 × 900`
  - `docs/design-qa/welfare-scan-1024.jpg` — 목록 중심 반응형 상태, `1024 × 768`
  - `docs/design-qa/admin-dashboard-reference.png` — 현재 관제 현황 디자인 기준
  - `docs/design-qa/welfare-scan-consistent.png` — 공통 관리자 UI 적용 후 복지 스캔
- Full-view comparison: `docs/design-qa/welfare-scan-comparison.png` — 참조와 1440px 구현을 같은 너비로 세로 배치
- Admin consistency comparison: `docs/design-qa/admin-welfare-consistency.png` — Arc 동일 뷰포트의 관제 현황과 복지 스캔을 가로 배치
- Source pixels: `1536 × 1024`; 시안 내부 주 화면 표기는 1440px
- State: 합성 대상자 3명의 복지 제안, 냉방기 고장 대상자의 상세 패널

## 결과

- 남은 P0/P1/P2 차이 없음.
- 레퍼런스의 상단 상태 바, 좌측 관리자 메뉴, 스캔 동작, 5개 요약 지표, 다중 필터,
  검토 표, 우측 상세 드로어를 기존 관리자 `--admin-*` 토큰과 PNG 자산으로 재현했다.
- 기존 관리자 화면의 보라색 주요 동작 색을 유지했다. 레퍼런스의 파란색과 다른 점은
  프로젝트 전체 관리자 디자인과의 일관성을 위한 의도된 차이다.
- 1024px에서는 좌측 메뉴를 아이콘 레일로 축소하고 지표·필터를 재배치했다. 표의 핵심
  열과 상세 보기 동작은 잘림 없이 유지된다.
- 필터 `추가 정보 필요` 2건, 대상자 이름 검색 1건, 두 번째 행 상세 패널, 공공 API 실패
  안내, DB 미연결 스캔 실패 안내를 실제 브라우저에서 확인했다.
- 좌측 메뉴의 실제 동작 2개가 관제 현황과 복지 스캔 양쪽에서 같은 위치를 유지하고 현재 화면을 강조한다.
  미리보기 문맥을 보존한 양방향 전환과 합성 관제 데이터 표시를 Arc에서 확인했다.
- LLM 확률·자동 수급 확정 같은 근거 없는 정보는 표시하지 않는다. Luna에는 임시 ID와
  구조화 설비 사실만 보내고 자격 후보 판정과 화면 근거는 규칙 엔진이 수행한다.

## 비교 이력

1. 최초 1440px 비교에서 시안의 임시 영문 지역명이 상단에 남아 있는 것을 발견했다.
2. 프로젝트 데이터와 무관한 문구를 `담당 지역 · 전체`로 교체했다.
3. CSS 상태 점을 기존 PNG 상태 자산으로 바꾸고 오버레이 색도 관리자 토큰으로 이동했다.
4. 1440px 드로어 상태와 1024px 목록 상태를 재캡처해 레이아웃·타이포·테두리·간격을 확인했다.
5. 관제 현황의 상단바를 공통 `AdminTopBar`로 이동하고 복지 스캔이 같은 컴포넌트를 사용하게 했다. 요약 카드·필터·표의 높이, 둘레선, 글자 계층을 관제 현황에 맞춰 Arc 동일 뷰포트에서 재비교했다.

final result: passed

---

# Design QA — 관리자 생활지원사 상세

## Comparison target

- Source visual truth: `/var/folders/nj/p0_b3g6d0y73t8t3dy_7cwhh0000gn/T/codex-clipboard-7b8e44e1-6c6f-4661-8866-575f72741743.png`
- Implementation screenshot: `docs/design-qa/admin-worker-detail-implementation.png`
- Full-view comparison: `docs/design-qa/admin-worker-detail-comparison.png` (source left, implementation right)
- Focused profile/information/table comparison: `docs/design-qa/admin-worker-detail-detail-comparison.png` (source left, implementation right)
- Viewport: desktop `1680 × 942` CSS px
- State: `/admin/workers/:workerId?date=2026-08-22`, assigned worker with an emergency alert-day snapshot

## Normalization

- Source: `1672 × 941` px.
- Implementation: `1680 × 942` px at a `1680 × 942` CSS viewport; browser reported device pixel ratio `2`, while the screenshot API returned CSS-sized pixels.
- Full comparison: each image scaled to `836 × 470` before horizontal composition.
- Focused comparison: `1140 × 520` crops scaled to `570 × 260` before horizontal composition.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the existing admin sans stack, weights, line heights, and hierarchy track the reference. Heading, metadata, badge, and dense table text remain readable without wrapping regressions.
- Spacing and layout rhythm: header, secondary breadcrumb, profile card, paired information cards, table, and right rail align to the same desktop composition. No horizontal overflow is present.
- Colors and visual tokens: all UI colors use the existing `--admin-*` token system, with the global semantic risk colors preserved for 위험 단계.
- Image quality and asset fidelity: the generated fictional care-worker portrait matches the reference's flat illustrated purple-vest treatment; existing raster admin icons and map artwork are reused without CSS/SVG stand-ins.
- Copy and content: section labels and actions follow the reference. Person, address, counts, statuses, activities, and risk reasons come from project data; risk reasons are displayed without rewriting.

## Interaction verification

- Dashboard `상세` link navigated to the worker detail route.
- Subject search submitted through the visible GET form and produced the explicit empty state.
- Phone, edit, subject-detail, assignment-change, list, and activity-history links expose the intended destinations.
- Browser console warnings/errors checked: none.

## Comparison history

1. Initial implementation: `docs/design-qa/admin-worker-detail-before.png`.
   - P1: a metropolitan road address produced `서구 북비산로`, treating the road name as an administrative region.
   - P2: the top header omitted the `관리자 관제` title and placed the breadcrumb inside the header.
   - P2: information rows and right-rail metrics were taller than the reference, reducing above-the-fold table and activity visibility.
2. Fixes applied:
   - Region extraction now distinguishes province-style and metropolitan addresses.
   - The reference header hierarchy and secondary breadcrumb row were restored for the worker detail screen.
   - Information rows, quick actions, metrics, and map card were compacted to the reference rhythm.
3. Post-fix evidence: `docs/design-qa/admin-worker-detail-comparison.png` and `docs/design-qa/admin-worker-detail-detail-comparison.png`.

## Follow-up polish

- P3: the reference map includes address callout labels; the implementation keeps the existing project map artwork and location pins, with full addresses available in the adjacent subject table.
- P3: the reference places small icons beside each information-row label; the implementation keeps the current admin detail-card label treatment for consistency with the existing product.

final result: passed
