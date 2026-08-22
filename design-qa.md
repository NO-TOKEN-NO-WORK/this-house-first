# 관리자 대시보드 디자인 QA

## 캡처 조건

- 레퍼런스: `/Users/byunghak/.codex/attachments/9503756b-628c-476b-b0de-a602a033662d/image-1.png`
- 구현 캡처: `.artifacts/admin-dashboard-implementation.png`
- 뷰포트 / 이미지 크기: 1672×941 CSS px / 1672×941 px
- 픽셀 밀도: DPR 1
- 상태: 2026.08.22, 전체 담당자·전체 상태, 최우선 대상 선택
- 캡처용 합성 데이터 경로는 검증 후 제거했으며 실제 화면 경로는 `/admin`이다.

## 비교 자료

- 전체: `.artifacts/admin-dashboard-comparison.png` — 위 레퍼런스, 아래 구현
- 사이드바: `.artifacts/admin-dashboard-sidebar-comparison.png` — 왼쪽 레퍼런스, 오른쪽 구현
- 지도·요약: `.artifacts/admin-dashboard-main-comparison.png` — 왼쪽 레퍼런스, 오른쪽 구현
- 관리표: `.artifacts/admin-dashboard-management-comparison.png` — 왼쪽 레퍼런스, 오른쪽 구현
- 모바일 320px: `.artifacts/admin-dashboard-320.png`

## 시각 판정

- P0: 0 — 화면 누락, 깨짐, 핵심 경로 차단 없음
- P1: 0 — 주요 구획, 높이, 정렬, 데이터 밀도, 색상 체계가 레퍼런스와 일치
- P2: 1 accepted — 원본 래스터 자산이 제공되지 않은 지도·프로필·아이콘의 세부 묘사는 생성 자산으로 대체했으며 슬롯 크기, 크롭, 팔레트와 역할은 동기화함
- 320·375·414·768px에서 문서 가로 넘침 0px

## 동작·접근성

- 지도 마커 선택 시 선택 건물 상세가 갱신됨
- `경보` 단계 발령 요청 성공 메시지 확인
- 핵심 버튼과 지도 마커에 접근 가능한 이름 제공
- 데스크톱·반응형 캡처 중 콘솔 오류와 4xx/5xx 응답 0건

## 검증 이력

1. 1672×941 매크로 레이아웃과 기존 관리자 기능을 결합했다.
2. 생성형 지표·건물·핀·닫기 아이콘을 실제 래스터 자산으로 교체했다.
3. 전체 및 집중 비교 후 팝업, 대상자 상세, 표 밀도와 반응형 흐름을 보정했다.
4. `npm run lint`, `npm test`(133/133), `next typegen`, `tsc --noEmit`, 프로덕션 `npm run build`, `git diff --check`를 통과했다.

final result: passed
