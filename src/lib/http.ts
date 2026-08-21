import { PublicDataError } from "./public-data/client";

/**
 * 앱 자체 API(Route Handler)의 오류 표현.
 * 공공데이터 프록시 오류(PublicDataError)와 응답 모양을 맞춰 클라이언트가 한 가지만 다루게 한다.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, code = "INVALID_PARAMETER") =>
  new ApiError(message, code, 400);

export const notFound = (message: string, code = "NOT_FOUND") =>
  new ApiError(message, code, 404);

/** 지금 상태에서 허용되지 않는 요청 — 상태머신 위반 등 */
export const conflict = (message: string, code = "CONFLICT") =>
  new ApiError(message, code, 409);

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError || error instanceof PublicDataError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error("API 처리 중 예상하지 못한 오류", error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "요청을 처리하지 못했습니다." } },
    { status: 500 },
  );
}

/** JSON 본문 파싱 — 비어 있으면 빈 객체 */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw badRequest("요청 본문은 JSON 객체여야 합니다.");
  }
  return parsed as Record<string, unknown>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" 검증 (AlertDay.date 표기) */
export function optionalIsoDate(
  value: unknown,
  name = "date",
): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    throw badRequest(`${name}는 YYYY-MM-DD 형식이어야 합니다.`);
  }
  return value;
}

export function optionalId(value: unknown, name: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    throw badRequest(`${name}가 올바르지 않습니다.`);
  }
  return value;
}

export function requiredId(value: unknown, name: string): string {
  const id = optionalId(value, name);
  if (!id) throw badRequest(`${name}는 필수입니다.`);
  return id;
}
