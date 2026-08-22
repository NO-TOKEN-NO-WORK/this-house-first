# ADR-0023: 복지 스캔 Luna 호출을 Vercel AI Gateway로 전환

- 상태: 승인됨
- 날짜: 2026-08-23

## 맥락

복지 스캔 Route Handler는 Vercel Function으로 배포되지만 OpenAI API를 직접 호출해
별도 `OPENAI_API_KEY`를 관리해야 했다. Vercel AI Gateway는 같은 Responses API와
`gpt-5.6-luna`를 지원하며 배포 함수에 OIDC 인증을 자동 제공한다.

## 결정

- 기존 `/api/welfare-scan` Route Handler와 네이티브 `fetch`를 유지한다.
- Responses API 대상만 Vercel AI Gateway로 바꾸고 모델 ID는
  `openai/gpt-5.6-luna`를 사용한다.
- Vercel 배포는 `VERCEL_OIDC_TOKEN`, 로컬은 `AI_GATEWAY_API_KEY`로 인증한다.
- ADR-0020의 비식별 입력, `store: false`, strict Structured Outputs, 규칙 기반 자격
  판정 경계는 그대로 유지한다.

## 근거

배포 비밀키와 회전 작업을 없애면서 현재 개인정보 경계와 응답 파서를 바꾸지 않는다.
Gateway는 OpenAI 호환 REST를 제공하므로 SDK나 새 패키지가 필요 없다.

## 대안

- OpenAI 직접 호출 유지: 별도 API 키 관리가 계속 필요해 제외
- Vercel AI SDK 도입: 현재 단일 요청은 네이티브 `fetch`로 충분해 제외

## 결과

Vercel 배포에서는 별도 AI 키 없이 OIDC로 Luna를 호출한다. 로컬 개발자는
`AI_GATEWAY_API_KEY`를 설정해야 하며 Gateway 장애 시 기존 부분 실패 폴백을 사용한다.
