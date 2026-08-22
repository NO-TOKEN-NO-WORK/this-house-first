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
