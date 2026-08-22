import { BriefingGenerationError } from "@/lib/briefing/openai";
import { getSubjectBriefing } from "@/lib/briefing/service";
import { requiredId, toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 한 대상자의 확인 기록만 온디맨드로 맥락 브리핑으로 만든다 (FR-12).
 * 인증·모델 실패는 기존 히스토리를 막지 않도록 빈 브리핑으로 폴백한다 (ADR-0024).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ subjectId: string }> },
): Promise<Response> {
  try {
    const { subjectId: rawSubjectId } = await context.params;
    const subjectId = requiredId(rawSubjectId, "subjectId");
    const briefing = await getSubjectBriefing(subjectId);
    return Response.json({ data: briefing });
  } catch (error) {
    if (error instanceof BriefingGenerationError) {
      console.warn(`[briefing] 생성 실패: ${error.code}`);
      return Response.json({ data: null });
    }
    return toErrorResponse(error);
  }
}
