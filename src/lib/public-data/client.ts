/**
 * 공공데이터포털 API 공통 클라이언트.
 *
 * 서버 전용 환경변수는 호출 시점에만 읽는다. Route Handler 밖에서 이 모듈을
 * 클라이언트 컴포넌트로 가져오지 않는다 (AGENTS.md: 외부 API는 서버 프록시).
 */

export type NextRequestInit = RequestInit & {
  next?: { revalidate: number };
};

export type PublicDataFetch = (
  input: URL,
  init?: NextRequestInit,
) => Promise<Response>;

export class PublicDataError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 502,
  ) {
    super(message);
    this.name = "PublicDataError";
  }
}

/** 인코딩 키/디코딩 키 어느 쪽을 붙여넣어도 URLSearchParams가 한 번만 인코딩하게 한다. */
export function normalizeServiceKey(rawKey: string): string {
  const key = rawKey.trim();
  if (!/%[0-9A-Fa-f]{2}/.test(key)) return key;

  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

export function requireServiceKey(envName: string): string {
  const rawKey = process.env[envName];
  if (!rawKey?.trim()) {
    throw new PublicDataError(
      `${envName} 환경변수가 설정되지 않았습니다.`,
      "MISSING_SERVICE_KEY",
      503,
    );
  }
  return normalizeServiceKey(rawKey);
}

/** 공공데이터포털에서 선택한 하나의 개인/프로젝트 서비스키. */
export function requirePublicDataServiceKey(): string {
  return requireServiceKey("PUBLIC_DATA_SERVICE_KEY");
}

function extractXmlError(text: string): string | null {
  const match = text.match(
    /<(?:returnAuthMsg|errMsg|resultMsg)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:returnAuthMsg|errMsg|resultMsg)>/i,
  );
  return match?.[1]?.trim() ?? null;
}

export async function fetchPublicDataJson<T>(
  url: URL,
  fetcher: PublicDataFetch = fetch,
  options: { revalidateSeconds?: number } = {},
): Promise<T> {
  const init: NextRequestInit = {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
    ...(options.revalidateSeconds == null
      ? { cache: "no-store" }
      : { next: { revalidate: options.revalidateSeconds } }),
  };

  let response: Response;
  try {
    response = await fetcher(url, init);
  } catch (error) {
    throw new PublicDataError(
      error instanceof Error && error.name === "TimeoutError"
        ? "공공데이터 API 응답 시간이 초과되었습니다."
        : "공공데이터 API에 연결하지 못했습니다.",
      "UPSTREAM_UNAVAILABLE",
    );
  }

  const text = await response.text();
  if (!response.ok) {
    throw new PublicDataError(
      `공공데이터 API가 HTTP ${response.status}로 응답했습니다.`,
      "UPSTREAM_HTTP_ERROR",
    );
  }

  if (text.trimStart().startsWith("<")) {
    throw new PublicDataError(
      extractXmlError(text) ?? "공공데이터 API가 JSON 대신 오류 XML을 반환했습니다.",
      "UPSTREAM_API_ERROR",
    );
  }

  try {
    const parsed = JSON.parse(text) as T;
    const gatewayError = (
      parsed as {
        OpenAPI_ServiceResponse?: {
          cmmMsgHeader?: {
            errMsg?: string;
            returnAuthMsg?: string;
            returnReasonCode?: string;
          };
        };
      }
    ).OpenAPI_ServiceResponse?.cmmMsgHeader;
    if (gatewayError) {
      throw new PublicDataError(
        gatewayError.returnAuthMsg ??
          gatewayError.errMsg ??
          "공공데이터포털 인증에 실패했습니다.",
        gatewayError.returnReasonCode ?? "UPSTREAM_AUTH_ERROR",
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof PublicDataError) throw error;
    throw new PublicDataError(
      "공공데이터 API 응답을 JSON으로 해석하지 못했습니다.",
      "INVALID_UPSTREAM_RESPONSE",
    );
  }
}

export function toPublicDataErrorResponse(error: unknown): Response {
  if (error instanceof PublicDataError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  console.error("공공데이터 처리 중 예상하지 못한 오류", error);
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "공공데이터를 처리하지 못했습니다.",
      },
    },
    { status: 500 },
  );
}

export function invalidParameter(message: string): PublicDataError {
  return new PublicDataError(message, "INVALID_PARAMETER", 400);
}
