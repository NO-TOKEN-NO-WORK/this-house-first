"use client";

import {
  HandoverList,
} from "@/components/today/SubjectInformationTabs";
import { useSubjectBriefing } from "@/components/today/useSubjectBriefing";
import { SUBJECT_INFORMATION_LABELS } from "@/lib/domain";

/**
 * 인수인계 카드 — 대상자 상세·방문 화면 상단의 세 줄 (FR-12 · ADR-0024, PRD F6).
 *
 * "담당 교체·대체 근무가 이 화면 한 장으로 끝난다"는 것이 목적이라, 방문·전화를 하러 들어온
 * 화면에서도 맥락이 보여야 한다. 대상자 정보 화면(`SubjectInfoView`)에는 두지 않는다 —
 * 거기서는 `AI 요약` 탭이 같은 내용을 더 넓게 보여 준다.
 *
 * 세 가지 상태가 있다.
 *  - 불러오는 중: 자리만 잡는다. 아래 위험 사유·기록이 나중에 밀리지 않게 높이를 미리 준다
 *  - 근거를 통과한 줄이 없음(또는 기록 자체가 없음): 빈 상태를 정상으로 말한다
 *  - 생성 실패·인증 미설정: **아무것도 그리지 않는다.** 기록 원문 화면은 그대로다 (ADR-0024 경계 5)
 */

const CARD =
  "flex flex-col gap-4 rounded-[10px] border border-border-default bg-surface-default p-6";

export function SubjectBriefingCard({ subjectId }: { subjectId: string }) {
  const { briefing, loading } = useSubjectBriefing(subjectId);

  if (loading) {
    return (
      <section className={CARD} aria-busy="true">
        <h2 className="text-label-15 text-text-secondary">
          {SUBJECT_INFORMATION_LABELS.BRIEFING_TAB}
        </h2>
        <p className="text-body-15 text-text-secondary" aria-live="polite">
          {SUBJECT_INFORMATION_LABELS.LOADING}
        </p>
      </section>
    );
  }

  if (!briefing) return null;

  return (
    <section className={CARD}>
      <h2 className="text-label-15 text-text-secondary">
        {SUBJECT_INFORMATION_LABELS.BRIEFING_TAB}
      </h2>
      {briefing.handover.length === 0 ? (
        <p className="text-body-15 text-text-secondary">
          {SUBJECT_INFORMATION_LABELS.EMPTY}
        </p>
      ) : (
        <HandoverList items={briefing.handover} />
      )}
    </section>
  );
}
