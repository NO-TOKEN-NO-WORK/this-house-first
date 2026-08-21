# ADR-0007: 지도는 카카오맵 JS SDK를 쓴다

- **상태**: 승인됨 (2026-08-22 근거·대안·결과 개정 — 결정은 유지)
- **날짜**: 2026-08-22
- **결정자**: 팀 전원

## 맥락 (Context)

관리자 대시보드는 건물 단위 위험 지도 + 가구 상태 색상이 핵심이다(FR-6, F5). 방문 큐의 출동 경로 제시(FR-7, Should)도 지도 위에서 이뤄진다. 대상 주소는 전부 한국이며, 건물 데이터는 국토부 건축HUB 건축물대장(FR-2, [ADR-0012](0012-seed-runner-tsx.md))에서 **법정동코드(시군구 5자리 + 법정동 5자리)** 로 조회한다. 48시간 해커톤이라 키 발급·계정 개설에 드는 시간 자체가 리스크다([ADR-0011](0011-deploy-local-demo-first.md)).

## 결정 (Decision)

**카카오맵 JavaScript SDK**로 지도·마커·오버레이를 구현한다. 주소→좌표 변환과 법정동코드 해석은 카카오 로컬 API(주소 검색), 출동 경로(FR-7) v0는 Kakao Developers의 **도보 경로 API**(또는 거리 기반 정렬)로 한다. 카카오모빌리티 자동차 길찾기는 제휴 승인이 나면 스트레치로 붙인다. SDK 앱 키는 `NEXT_PUBLIC_KAKAO_MAP_KEY`, REST 키(`KAKAO_REST_KEY`)는 서버 전용 env로 관리한다.

## 근거 (Rationale)

1. **지오코딩 응답에 법정동코드가 포함된다 — 건축HUB 파이프라인의 접착제.** 카카오 주소 검색 API는 결과의 `address`에 `b_code`(법정동 10자리)·`h_code`(행정동)·`main_address_no`/`sub_address_no`를 함께 돌려준다. 건축HUB 표제부 조회 키(`sigunguCd`+`bjdongCd`)가 정확히 `b_code`의 앞 5·뒤 5자리이므로 **지오코딩 1회로 건축물대장 조회 키까지 얻는다**(`src/lib/kakao/local.ts`의 `resolveRegionCodes`). 네이버 Geocoding은 `addressElements[].code`가 공식 레퍼런스 예시에서 전부 빈 문자열이라 법정동코드를 얻으려면 Reverse Geocoding(`legalcode.code.id`)을 한 번 더 왕복해야 한다.
2. **키 발급 마찰이 낮다.** Kakao Developers는 결제수단 등록 없이 앱 생성 즉시 JS/REST 키를 발급하고 `http://localhost:3000`을 플랫폼 도메인으로 등록할 수 있다. 네이버는 기존 "AI NAVER API > 지도"가 2025-05-22 신규 신청 차단, 2025-07-01 무료 제공 종료되어 NCP의 신규 Maps 상품을 써야 하며, NCP 일반 회원가입은 결제수단(신용카드/계좌) 등록이 필수다. 무료 구간은 있으나 카드 등록과 한도 설정이 선행된다.
3. **동 단위 방문 동선에 맞는 경로 API를 제휴 없이 쓸 수 있다.** 2026-07-21부터 Kakao Developers 카카오맵 API에 도보·자전거·대중교통 경로가 추가됐다(각 일 1,000건 무료, 초과 건당 10원). 생활지원사가 한 법정동 안에서 하루 ~4가구(PRD P3)를 도는 동선은 도보가 현실적이므로 FR-7 v0에 충분하다.

**근거가 아닌 것**: 무료 쿼터. 카카오(JS SDK 일 30만, 로컬 API 각 일 10만·월 합산 300만)와 네이버(Web Dynamic Map 월 1,000만, Geocoding·Reverse 월 300만) 모두 데모 사용량(일 1,000건 미만)을 수십 배 초과하므로 변별력이 없다.

## 검토한 대안 (Alternatives)

- **네이버 지도 (NCP Maps)** — 두 지점에서 오히려 우위: (a) 자동차 길찾기 Directions 5(월 6만 무료)/15(월 3천 무료)가 NCP 콘솔에서 셀프 신청인 반면 카카오모빌리티 자동차 길찾기는 카카오비즈니스 계정 + 앱 ID·사업자명을 메일로 제출해 승인받아야 한다. (b) `naver.maps.visualization.HeatMap`이 내장인 반면 카카오 Web API에는 히트맵 클래스가 없다. 그럼에도 근거 1·2(건축HUB 연계, 48h 내 키 발급)가 더 무거워 기각. 자동차 동선이 필수가 되면 재검토.
- **Leaflet + OSM** — 키 불필요 장점은 있으나 지오코딩·법정동코드·경로를 별도 서비스로 조달해야 해 연동 수가 늘어남. 기각
- **Google Maps** — 국내 지도 데이터 제약, 법정동코드 미제공. 기각

## 결과 (Consequences)

- 긍정: 지오코딩 → 건축물대장 조회가 한 호출 체인으로 닫힘. 키 발급 당일 완료. 경로 API까지 한 계정
- 부정/트레이드오프:
  - 히트맵 클래스가 없어 건물별 `Circle`/`CustomOverlay`로 직접 그린다. 단, FR-6는 건물 10동의 **이산 점수**를 보여주는 것이라 커널 밀도 히트맵은 단일 건물 신호를 번지게 해 오히려 부적합하다 — 건물별 오버레이 색칠이 맞는 시각화라는 판단(설계 판단이며 검증된 사실은 아님)
  - 자동차 길찾기는 제휴 승인 필요 → v0는 도보 경로/거리 정렬. 승인이 나지 않으면 자동차 동선은 제공하지 않는다
  - **무료 쿼터는 개발자 계정당 첫 번째로 카카오맵 API를 활성화한 앱에만 적용**(2026-07-21~). 키를 발급하는 팀원이 이미 다른 앱으로 카카오맵을 썼다면 이 프로젝트 앱은 유료 대상이 된다 → 새 계정으로 발급하거나 첫 앱인지 확인
  - SDK가 전역 스크립트 방식이라 React 래핑 필요(react-kakao-maps-sdk 사용 가능 — 도입 시 이 ADR 범위 내로 본다)
- 되돌리기: 지도 컴포넌트를 `src/components/map/`에, 지오코딩을 `src/lib/kakao/`에 격리. 네이버 전환 시 법정동코드 해석만 Reverse Geocoding 왕복으로 바꾸면 된다

## 출처

- [Kakao Developers 쿼터](https://developers.kakao.com/docs/ko/getting-started/quota) · [카카오맵 API 신규 기능 및 무료 쿼터 운영 방식 변경 안내 (2026-07-21)](https://devtalk.kakao.com/t/api-notice-on-new-kakao-map-api-features-and-free-quota-policy/150222)
- [카카오 로컬 REST API — 주소 검색 응답 `b_code`/`h_code`](https://developers.kakao.com/docs/ko/local/dev-guide) · [Kakao 지도 Web API 문서](https://apis.map.kakao.com/web/documentation/) · [키 발급·도메인 등록 가이드](https://apis.map.kakao.com/web/guide/)
- [카카오모빌리티 길찾기 API 시작하기](https://developers.kakaomobility.com/affiliate/navi-api/start) · [쿼터 및 가격](https://developers.kakaomobility.com/price/)
- [NCP 공지: AI NAVER API 지도 API 신규 이용 신청 차단 및 무료 이용량 제공 중단 (2025-03-24)](https://www.ncloud.com/support/notice/all/1930) · [Maps API 무료 이용량 정책](https://www.ncloud-forums.com/topic/129/) · [Maps API 요금표 ('23.1~)](https://www.ncloud-forums.com/topic/99/)
- [NCP Geocoding 레퍼런스](https://api.ncloud-docs.com/docs/ai-naver-mapsgeocoding-geocode) · [Reverse Geocoding 레퍼런스](https://api.ncloud-docs.com/docs/ai-naver-mapsreversegeocoding-gc) · [Directions 5](https://guide.ncloud-docs.com/docs/maps-direction5-api) · [Directions 15](https://guide.ncloud-docs.com/docs/maps-direction15-api) · [HeatMap](https://navermaps.github.io/maps.js.ncp/docs/naver.maps.visualization.HeatMap.html) · [결제수단 등록](https://guide-fin.ncloud-docs.com/docs/userguide-userguidepricing-5)
