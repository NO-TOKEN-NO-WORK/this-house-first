# 공공데이터 API 연동

PRD §8의 공공데이터 3종을 서버 Route Handler로 연동한다. 서비스 키는 모두
공공데이터포털에서 활용신청 후 발급받으며, 브라우저에 노출하지 않는다.

## 활용신청

| 데이터 | 공식 신청 페이지 | 환경변수 |
|---|---|---|
| 기상청 단기예보 조회서비스 | <https://www.data.go.kr/data/15084084/openapi.do> | `PUBLIC_DATA_SERVICE_KEY` |
| 기상청 기상특보 조회서비스 | <https://www.data.go.kr/data/15000415/openapi.do> | `PUBLIC_DATA_SERVICE_KEY` |
| 국토교통부 건축HUB 건축물대장정보 서비스 | <https://www.data.go.kr/data/15134735/openapi.do> | `PUBLIC_DATA_SERVICE_KEY` |
| 행정안전부 행정동별 성·연령별 주민등록 인구수 | <https://www.data.go.kr/data/15108072/openapi.do> | `PUBLIC_DATA_SERVICE_KEY` |

공공데이터포털에서 같은 일반 인증키를 사용하더라도 각 API별 활용신청은 필요하다.
발급 화면의 인코딩/디코딩 키 어느 쪽을 넣어도 클라이언트가 한 번만 URL 인코딩한다.

```bash
cp .env.example .env
# .env에 공공데이터포털 서비스키 하나 입력
npm run dev
```

## 내부 Route Handler

### 익일 폭염 트리거

```text
GET /api/trigger?nx=60&ny=127
GET /api/trigger?nx=60&ny=127&targetDate=20260823
```

기상청 단기예보의 시간별 기온(`TMP`)·습도(`REH`)를 기상청 여름철 체감온도
산식에 넣고 일 최고값을 계산한다. 운영 단계는 PRD F1 및 2026년 기상청 기준에
따라 주의 33℃, 경보 35℃, 비상 38℃(또는 기온 39℃)로 판정한다. 공식 주의보와
경보의 2일 지속 조건과 달리, 앱의 단계는 익일 돌봄 대응 강도를 정하는 1일 판정이다.

`nx`, `ny`는 기상청 5km 격자좌표다. `baseDate`, `baseTime`을 함께 지정하면 과거
발표분이나 데모 고정 데이터를 확인할 수 있다.

`GET`은 판정만 하고 DB를 건드리지 않는다. 실제 발령은 `POST`다.

```text
POST /api/trigger?nx=89&ny=90                                  # 예보로 익일 판정 후 발령
POST /api/trigger  {"level":"EMERGENCY","targetDate":"20260821"}   # 수동 발령 (ADR-0011 데모)
POST /api/trigger  {"feelsLikeMax":36}                          # 체감온도만 주면 판정 로직을 태운다
```

발령되면 `AlertDay` 1건 + 대상자 전원의 `RiskAssessment`(점수·등급·사유) +
`HouseholdDayStatus`(1등급은 `VISIT_QUEUED`, 나머지 `UNCHECKED`)를 만든다.

- **임계값 미달이면 아무것도 만들지 않는다** — `{"alerted": false, "reason": ...}`만 돌아온다.
  비경보일에 `AlertDay` 행이 없어야 알림 0건이 보장된다(PRD §9)
- **같은 날 재발령해도 진행 중인 확인 기록을 덮어쓰지 않는다.** 미확인 가구가 1등급이 되면
  방문 큐로 승격하고, 전화 완료·방문 중·119 연계는 그대로 둔다
  (`src/lib/escalation/initial.ts`)

### 기상특보 목록

```text
GET /api/public-data/weather-warnings
GET /api/public-data/weather-warnings?fromDate=20260822&toDate=20260822
```

### 건축물대장 표제부

```text
GET /api/public-data/buildings?sigunguCd=11680&bjdongCd=10300&platGbCd=0&bun=12&ji=0
```

법정동코드 앞 5자리는 `sigunguCd`, 뒤 5자리는 `bjdongCd`다. 번·지는 API 형식에
맞게 4자리로 보정한다. 응답은 스코어링에 필요한 사용승인연도, 구조, 주용도,
단독주택 여부 중심으로 정규화한다. 실제 주소·건물값만 사용하고 대상자 인물정보와
결합할 때는 반드시 합성 인물을 사용한다.

### 연령별 주민등록 인구

```text
GET /api/public-data/population?administrationCode=1111054000&fromYearMonth=202607
```

원 API는 10세 단위 연령구간이므로 정확한 65세 이상 수를 만들 수 없다. 응답은
60대 구간을 별도 보존하고, 오해가 없도록 `age70Plus`와 `age70PlusShare`를 제공한다.
