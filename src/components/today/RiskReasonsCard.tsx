import {
  AlertCircleIcon,
  HomeIcon,
  UserIcon,
} from "@/components/today/icons";
import type { SubjectAssessment } from "@/lib/board/subject";
import {
  type LabeledReason,
  REASON_CATEGORY_LABEL,
  ReasonCategory,
} from "@/lib/scoring/reasons";

/** 위험 사유는 스코어링 엔진의 문장을 바꾸지 않고 분류 아이콘만 붙인다. */
const REASON_ICON: Record<ReasonCategory, typeof UserIcon> = {
  [ReasonCategory.PERSONAL]: UserIcon,
  [ReasonCategory.BUILDING]: HomeIcon,
  [ReasonCategory.WEATHER]: AlertCircleIcon,
};

function ReasonRow({ reason }: { reason: LabeledReason }) {
  const Icon = reason.category ? REASON_ICON[reason.category] : null;
  return (
    <li className="flex items-center gap-2.5 text-body-16 text-text-primary">
      {Icon && (
        <Icon
          className={`size-5 shrink-0 ${
            reason.category === ReasonCategory.WEATHER
              ? "text-status-critical"
              : "text-icon-default"
          }`}
        />
      )}
      {reason.category && (
        <span className="shrink-0 font-bold">
          {REASON_CATEGORY_LABEL[reason.category]}
        </span>
      )}
      <span className="min-w-0 flex-1 break-words">{reason.text}</span>
    </li>
  );
}

export function RiskReasonsCard({
  assessment,
  showPlan = false,
}: {
  assessment: SubjectAssessment;
  showPlan?: boolean;
}) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-[10px] border border-border-default bg-surface-default p-6">
      <h2 className="text-label-15 text-text-secondary">위험 사유</h2>
      <ul className="flex flex-col gap-2.5">
        {assessment.reasons.map((reason) => (
          <ReasonRow key={reason.text} reason={reason} />
        ))}
      </ul>
      {showPlan && (
        <p className="text-body-15 text-text-secondary">
          대응 지시 · {assessment.plan}
        </p>
      )}
    </section>
  );
}
