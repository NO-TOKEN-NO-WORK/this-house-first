"use client";

import Link from "next/link";
import { RiskReasonsCard } from "@/components/today/RiskReasonsCard";
import {
  GradeChangeNotice,
  VisitChecklist,
  VisitHistory,
} from "@/components/today/SubjectInformationSections";
import { SubjectSummary } from "@/components/today/SubjectSummary";
import { ChevronLeftIcon } from "@/components/today/icons";
import type { SubjectDetail } from "@/lib/board/subject";

const BACK_BUTTON =
  "flex size-11 items-center justify-center text-icon-primary";

/**
 * 카드 chevron에서 여는 읽기 전용 대상자 정보 화면 (Figma 125:6175).
 * 기록 행동은 방문·전화 CTA가 맡고, 이 화면은 판단 근거와 최근 맥락만 보여 준다.
 */
export function SubjectInfoView({
  detail,
  backHref,
  onBack,
}: {
  detail: SubjectDetail;
  backHref: string;
  onBack?: () => void;
}) {
  const assessment = detail.assessment;

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col bg-surface-default">
      <header className="sticky top-0 z-30 grid h-[calc(53px_+_var(--safe-top))] grid-cols-[44px_1fr_44px] items-center bg-surface-default px-1.5 pt-[var(--safe-top)]">
        {onBack ? (
          <button
            type="button"
            aria-label="담당자 화면으로"
            onClick={onBack}
            className={BACK_BUTTON}
          >
            <ChevronLeftIcon className="size-[22px]" />
          </button>
        ) : (
          <Link
            href={backHref}
            aria-label="담당자 화면으로"
            className={BACK_BUTTON}
          >
            <ChevronLeftIcon className="size-[22px]" />
          </Link>
        )}
        <h1 className="text-center text-label-15 text-text-primary">
          대상자 정보
        </h1>
        <span aria-hidden />
      </header>

      <main className="flex flex-1 flex-col gap-5 px-5 py-6 pb-10">
        <SubjectSummary
          name={detail.name}
          age={detail.age}
          livesAlone={detail.livesAlone}
          grade={assessment?.grade}
          phone={detail.phone}
          address={detail.roadAddress ?? detail.address}
        />

        <GradeChangeNotice detail={detail} />

        {assessment && <RiskReasonsCard assessment={assessment} />}

        <VisitChecklist />
        <VisitHistory items={detail.recentHistory} />
      </main>
    </div>
  );
}
