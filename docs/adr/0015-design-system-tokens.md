# ADR-0015: 디자인 시스템 — Figma Foundations를 Primitive/Semantic 2층 토큰으로 옮긴다

- **상태**: 승인됨
- **날짜**: 2026-08-22
- **결정자**: 팀 전원

## 맥락 (Context)

Figma `이집먼저` 파일에 **02 · Foundations** 페이지(node `16:25`)가 생겼다. 화면별로 색을 뽑아 쓰던 것을 디자이너가 팔레트로 정리한 것이다. 두 층으로 되어 있다.

| 층 | Figma 노드 | 내용 |
|---|---|---|
| Primitive Colors | `16:29` | 화면에서 추출한 원시 색 24개 (`neutral/*`, `navy/*`, `red/*`, `amber/*`, `green/500`, `warm/100`, `black/50`) |
| Semantic Colors | `16:30` | 역할·상태 이름 (`color/text/primary`, `color/status/critical` …) |
| Typography | `16:31` | `Pretendard JP Variable` 기반 역할/크기 스타일 |

Figma가 명시한 사용 규칙이 있다 — *"컴포넌트에는 아래 값을 직접 사용하지 않고 Semantic Colors를 사용합니다"* (`16:33`). 스와치 라벨에는 CSS 변수 이름까지 적혀 있다(`var(--color-text-primary)`).

기존 `globals.css`는 화면에서 눈으로 뽑은 이름(`--color-ink`, `--color-slate`, `--color-calm` …) 한 층뿐이었고 ADR-0014가 그 상태를 전제하고 있었다. 옮기면서 네 가지가 걸렸다.

1. **Foundations 페이지는 전체가 아니다.** 실제 화면(`0:1` UI 페이지)이 쓰는 Figma 변수 컬렉션을 뽑아 보니 색 34개·타이포 19개다. Foundations는 그중 큐레이션된 일부다. `color/text/supporting`·`color/action/secondary`·`color/border/soft`·`Body/15 Relaxed`·`Heading/19`·`Label/13` 등은 화면이 쓰는데 Foundations에는 없다.
2. **`@theme inline`은 `--color-*`를 `:root`에 내보내지 않는다.** 값을 유틸리티에 인라인할 뿐이다. 그래서 `KakaoMap`이 `getComputedStyle(...).getPropertyValue("--color-danger")`로 읽던 마커 색은 **항상 빈 문자열이었다**(기존 버그).
3. **기존 이름 중 일부는 Figma에 대응 토큰이 없다** — 조치함 기록 버튼 배경(`#eaf0f9`), 보조 행동 버튼 눌림 배경(`#374151`), 안전 결과 버튼의 글자/배경(`#136a42`/`#e6f4ec`), 주의 칩 배경(`#9ca3af`).
4. **Tailwind 자동 탐색은 Markdown도 평문으로 읽는다.** ADR과 에이전트 지침에 금지 예시로 적은 `text-[15px]`·`bg-[#fff]`까지 실제 CSS 유틸리티로 생성됐다. 앱과 무관한 문서가 산출물과 디자인 시스템 경계를 바꾸고 있었다.

## 결정 (Decision)

- **`src/app/globals.css`를 Primitive/Semantic 2층으로 재구성한다.**
  - **1층 Primitive**는 평범한 `:root` 커스텀 프로퍼티다. `@theme`에 넣지 않으므로 `bg-neutral-500` 같은 유틸리티가 **생기지 않는다**. Figma의 "원시 색은 직접 쓰지 않는다" 규칙이 문법으로 강제된다.
  - **2층 Semantic**만 `@theme`에 들어간다. 변수 이름은 Figma 스와치에 적힌 이름을 그대로 쓴다(`--color-text-primary` → `text-text-primary`). 유틸리티 이름이 길어지지만, 디자이너가 Figma에서 본 이름으로 코드를 grep할 수 있다는 값이 더 크다.
- **`@theme static`을 쓴다.** `inline`과 달리 유틸리티에서 안 쓰는 토큰까지 `:root`에 항상 내보내므로 JS에서 `getComputedStyle`로 읽어도 안전하다. 위 2번 버그가 이걸로 사라진다.
- **Tailwind 기본 팔레트를 지운다** (`--color-*: initial`). `bg-white`·`text-zinc-500`·`text-red-700`은 이제 존재하지 않는 클래스다. 디자인 시스템 밖의 색이 화면에 섞이면 위험 단계 색이 화면마다 달라 보인다.
- **Tailwind 탐색 기준을 `src/`로 한정한다** (`@import "tailwindcss" source("../")`). 문서의 코드 예시가 앱 CSS를 만들지 않게 한다.
- **토큰은 Foundations 페이지가 아니라 Figma 변수 컬렉션 전체(색 34 + 타이포 19)를 옮긴다.** Foundations는 문서화된 일부일 뿐 화면이 실제로 쓰는 이름이 더 많다.
- **타이포그래피는 역할/크기 이름을 그대로 토큰화한다** (`text-display-28`, `text-body-15-relaxed`, `text-label-16-compact` …). Figma의 `lineHeight: 100`(=Auto)은 `normal`로, 명시 수치(22.4px·22.5px)는 px 그대로 옮겼다. `Navigation/11`의 `letterSpacing: 2`는 `2px`이다(Figma dev context가 `tracking-[2px]`로 확인해 준다).
- **담당자·공용 Tailwind 화면의 색·글자 클래스를 전부 새 토큰으로 옮긴다.** 임의값(`text-[15px]`, `bg-white`, `text-zinc-400`)은 코드에서 사라진다. 관리자 CSS Module은 기존 `tokens.css`의 `--admin-*` 체계를 유지하고, 위험 단계 색만 전역 Semantic 토큰을 참조해 두 화면의 의미를 맞춘다.

### 옛 이름 → 새 이름

| 옛 토큰 | 새 토큰 | 값 |
|---|---|---|
| `ink` | `text-primary` | `#1b2430` 그대로 |
| `ink-soft` | `text-secondary` | `#5b6675` 그대로 |
| `ink-strong` | `text-supporting`(글자) · `icon-default`(아이콘) | `#374151` 그대로 |
| `line` | `border-default` | `#e2e7ee` 그대로 |
| `line-soft` | `border-soft` | `#dde3ea` 그대로 |
| `info` | `background-subtle` | `#edf0f3` 그대로 |
| `brand` / `brand-deep` | `action-primary` / `action-primary-strong` | 그대로 |
| `danger` / `-ink` / `-soft` | `status-critical` / `-strong` / `-subtle` | 그대로 |
| `warn` / `-ink` | `status-warning` / `-strong` | 그대로 |
| `safe` | `status-success` | 그대로 |
| `surface`(화면 배경) | `background-subtle` | `#f4f6f9` → **`#edf0f3`** |
| `warn-soft` | `status-warning-subtle` | `#fdf1de` → **`#fcf8e9`** |
| `line-strong`(안내 상자 테두리) | `border-strong` | `#c6cfda` → **`#9ca3af`** |
| `slate`(보조 행동 버튼) | `action-secondary` | `#6b7280` → **`#4b5563`** |
| `ink-strong`(보조 행동 버튼 눌림) | `action-secondary-strong`(확장) | `#374151` 그대로 |
| `slate`(주의 글자) | `text-tertiary` | `#6b7280` 그대로 |
| `disabled` | `surface-soft` | `#e2e7ee` 그대로 (아래 결과 §2 참고) |
| `calm` | `status-neutral`(확장) | `#9ca3af` 그대로 |
| `brand-soft` | `action-primary-subtle`(확장) | `#eaf0f9` 그대로 |
| `safe-ink` / `safe-soft` | `status-success-strong` / `-subtle`(확장) | 그대로 |

## 근거 (Rationale)

- **2층으로 나눈 이유는 색 하나를 두 화면이 다르게 쓰는 사고를 막기 위해서다.** 원시 색에 유틸리티를 만들지 않으면 "이 회색"이 아니라 "이 역할"로만 쓸 수 있다. Figma가 같은 규칙을 글로 적어 둔 것을 문법으로 옮겼을 뿐이다.
- **`static`을 고른 것은 이미 난 버그 때문이다.** 토큰을 JS에서 읽는 코드가 하나라도 있으면 `inline`은 조용히 빈 값을 준다. 지도 마커가 그랬다.
- **기본 팔레트를 지운 것은 리뷰 부담을 줄이려는 것이다.** `text-red-700`이 눈에 띄는지에 의존하지 않고 빌드가 막는다.
- **Foundations가 아니라 변수 컬렉션 전체를 옮긴 것은**, Foundations만 옮기면 화면이 이미 쓰는 `Body/15 Relaxed`·`Heading/19`·`Label/13`을 임의값으로 남겨야 하기 때문이다. 그러면 "임의값을 없앤다"는 목적이 반쯤 무너진다.

## 검토한 대안 (Alternatives)

- **기존 한 층 토큰에 Figma 값만 덮어쓰기** — 이름이 화면 관찰에서 온 것(`ink`·`calm`)이라 디자이너가 Figma에서 찾을 수 없다. 원시 색 직접 사용도 계속 가능하다. 기각
- **유틸리티 이름 줄이기**(`--color-text-primary` 대신 `--color-fg`) — 짧아지지만 Figma 스와치에 적힌 이름(`var(--color-text-primary)`)과 어긋난다. 디자인·코드 사이 번역표가 하나 더 생긴다. 기각
- **`@theme inline` 유지 + JS 읽기를 별도 상수로** — 마커 색이 CSS와 TS 두 곳에 생긴다. 색 하나의 원본이 둘이 되는 게 이 ADR이 막으려는 것 자체다. 기각
- **Tailwind 기본 팔레트 유지** — 도입 비용은 0이지만 `bg-neutral-500`(Tailwind `#737373`)이 우리 `neutral/500`(`#6b7280`)인 척한다. 기각

## 결과 (Consequences)

- 긍정
  - 색·글자의 원본이 Figma 변수 하나로 모였다. 디자이너가 값을 바꾸면 `globals.css`의 Primitive 한 줄만 고치면 된다
  - **지도 마커 색 버그가 고쳐졌다.** `--color-status-critical` 등이 이제 `:root`에 실제로 나온다
  - 코드에서 임의 색·임의 글자 크기가 사라졌다 (`text-[15px]`·`bg-white`·`zinc-*` 0건)
  - Tailwind가 `src/`만 탐색하므로 문서의 금지 예시가 임의 유틸리티로 산출되지 않는다
  - 보조 행동 버튼(`방문하기`·`전화하기`·`대상자 확인`)의 흰 글자 대비가 **4.83:1 → 7.56:1**로 올랐다 (`#6b7280` → `#4b5563`). 랜딩 화면의 `zinc-400` 보조 문구도 2.85:1 → 4.83:1
  - 위험 단계 섹션의 계획 문구는 `text-primary`로 통일했다. 위험 단계는 바로 앞 칩이 전달하며, 새 `background/subtle` 위에서 경계 4.45:1·주의 4.23:1이던 대비를 13.68:1로 올렸다
- 부정/트레이드오프
  1. **유틸리티 이름이 길다** (`text-text-primary`, `bg-background-subtle`). Figma 이름과의 1:1 대응을 산 값이다
  2. **비활성 버튼 배경은 `surface-soft`(`#e2e7ee`)를 쓴다.** 역할상으로는 `action-disabled`(`#c6cfda`)가 맞지만 그 위의 `text-secondary`가 3.67:1로 WCAG AA에 못 미친다. `surface-soft`는 4.67:1이다 — ADR-0014가 이미 같은 이유로 택한 값을 유지한다
  3. **화면 배경이 `#f4f6f9` → `#edf0f3`으로 살짝 어두워지고**, 경계 결과 버튼 배경이 `#fdf1de` → `#fcf8e9`로 바뀐다. 둘 다 Figma 값이 맞다
  4. **`text-body-16`은 줄높이 22.4px를 함께 싣는다.** 예전 `text-base`는 줄높이를 지정하지 않았으므로 본문 여러 줄이 조금 넓어진다
  5. **13px 보통 굵기·11px 굵은 글씨는 팔레트에 없어 가장 가까운 토큰으로 올렸다** — 결과 버튼의 부연은 `Body/14`로, 배지(`선택됨`·`지원사업 연계`)는 `Caption/12`로. 60대 사용자 기준(PRD §9)에서 커지는 방향이라 그대로 둔다
  6. **`선택됨` 배지는 `#374151` → `action-secondary`(`#4b5563`)로 바뀐다.** 눌림 상태는 기존 값(`#374151`)을 `action-secondary-strong` 확장 토큰으로 유지해 글자 역할 토큰을 배경에 재사용하지 않는다
- **디자이너에게 확인이 필요한 것** — 아래 다섯 역할은 Figma 변수 컬렉션에 이름이 없어 `globals.css`에 `잠정`으로 두었다. 이름이 생기면 확장 묶음을 지운다
  - `action/primary-subtle` `#eaf0f9` (조치함 기록 버튼 배경)
  - `action/secondary-strong` `#374151` (보조 행동 버튼 눌림 배경)
  - `status/success-strong` `#136a42`, `status/success-subtle` `#e6f4ec` (안전 결과 버튼) — `green/50`·`green/700` 원시 색도 없다
  - `status/neutral` `#9ca3af` (주의 칩 배경) — 값은 `border/strong`과 같지만 역할이 다르다
- **CSS 변수를 쓸 수 없는 PWA 정적 메타데이터는 해석값을 복제한다.** `src/app/layout.tsx`와 `public/today.webmanifest`의 위험색은 `status/critical`과 같은 `#d93025`, manifest 배경은 `neutral/0`과 같은 `#ffffff`로 맞춘다. 앱 아이콘 파일은 Figma의 `app icon` 원본을 그대로 사용하므로 화면용 Semantic 토큰 동기화 대상에서 제외한다
- 되돌리기: 토큰은 `globals.css` 한 파일, 화면 변경은 클래스 이름 치환뿐이라 파일 단위로 되돌릴 수 있다. ADR-0014의 결정(문구는 `domain.ts`, 색은 Figma)은 그대로 유효하며 이 ADR은 그중 "색" 쪽을 구체화한 것이다
