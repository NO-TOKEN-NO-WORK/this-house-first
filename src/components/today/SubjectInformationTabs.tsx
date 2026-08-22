"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Dialog } from "@/components/Dialog";
import { MapPinIcon, PhoneIcon } from "@/components/today/icons";
import { VisitHistory } from "@/components/today/SubjectInformationSections";
import type {
  BriefingConversationSummary,
  SubjectBriefingView,
} from "@/lib/briefing/types";
import type { SubjectHistoryItem } from "@/lib/board/subject";
import {
  CallResult,
  CHECK_KIND_DETAIL_LABEL,
  CheckKind,
  SUBJECT_INFORMATION_LABELS,
} from "@/lib/domain";

type Tab = "history" | "briefing";

export function SubjectInformationTabs({
  history,
  briefing,
  loading,
}: {
  history: SubjectHistoryItem[];
  briefing: SubjectBriefingView | null;
  loading: boolean;
}) {
  const [tab, setTab] = useState<Tab>("history");
  const [selected, setSelected] = useState<SubjectHistoryItem | null>(null);
  const summaryByEvent = useMemo(
    () => new Map(
      (briefing?.conversationSummaries ?? []).map((summary) => [
        summary.source.checkEventId,
        summary,
      ]),
    ),
    [briefing],
  );

  return (
    <section className="flex flex-col">
      <div role="tablist" aria-label="대상자 확인 기록" className="flex w-full">
        <TabButton
          selected={tab === "history"}
          onClick={() => setTab("history")}
        >
          {SUBJECT_INFORMATION_LABELS.HISTORY_TAB}
        </TabButton>
        <TabButton
          selected={tab === "briefing"}
          onClick={() => setTab("briefing")}
        >
          {SUBJECT_INFORMATION_LABELS.BRIEFING_TAB}
        </TabButton>
      </div>

      <div role="tabpanel" className="pt-5">
        {tab === "history" ? (
          <VisitHistory items={history} embedded onSelect={setSelected} />
        ) : (
          <BriefingPanel briefing={briefing} loading={loading} />
        )}
      </div>

      <RecordSummaryDialog
        item={selected}
        summary={selected ? summaryByEvent.get(selected.id) ?? null : null}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`flex h-11 flex-1 items-center justify-center border-b px-3 text-body-16 text-text-primary ${
        selected
          ? "border-b-2 border-action-primary-strong"
          : "border-border-subtle"
      }`}
    >
      {children}
    </button>
  );
}

export function BriefingPanel({
  briefing,
  loading,
}: {
  briefing: SubjectBriefingView | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <p className="py-4 text-body-15 text-text-secondary" aria-live="polite">
        {SUBJECT_INFORMATION_LABELS.LOADING}
      </p>
    );
  }
  if (!briefing || briefing.handover.length === 0) {
    return (
      <p className="py-4 text-body-15 text-text-secondary">
        {SUBJECT_INFORMATION_LABELS.EMPTY}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {briefing.handover.length > 0 && (
        <BriefingSection title={SUBJECT_INFORMATION_LABELS.OVERVIEW}>
          <ul className="flex flex-col gap-5">
            {briefing.handover.map((item) => (
              <li key={`${item.category}-${item.source.checkEventId}`}>
                <p className="text-label-15 text-text-secondary">
                  {item.categoryLabel}
                </p>
                <p className="mt-2 text-body-16 text-text-primary">{item.text}</p>
                <EvidenceLabel label={item.source.label} />
              </li>
            ))}
          </ul>
        </BriefingSection>
      )}
    </div>
  );
}

function BriefingSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label-15 text-text-secondary">{title}</h2>
      {children}
    </section>
  );
}

function EvidenceLabel({ label }: { label: string }) {
  return (
    <p className="mt-1.5 text-body-14 text-text-secondary">
      {SUBJECT_INFORMATION_LABELS.EVIDENCE} · {label}
    </p>
  );
}

function resultTone(item: SubjectHistoryItem): string {
  // CALL·VISIT가 같은 OK/SYMPTOM/EMERGENCY_119 코드를 공유한다.
  if (item.result === CallResult.OK) {
    return "bg-status-success text-text-inverse";
  }
  if (
    item.result === CallResult.SYMPTOM ||
    item.result === CallResult.EMERGENCY_119
  ) {
    return "bg-status-critical text-text-inverse";
  }
  return "bg-status-warning-subtle text-status-warning-strong";
}

function RecordSummaryDialog({
  item,
  summary,
  onClose,
}: {
  item: SubjectHistoryItem | null;
  summary: BriefingConversationSummary | null;
  onClose: () => void;
}) {
  const titleId = useId();
  if (!item) return null;
  const longDate = `${item.date.replaceAll("-", ".")} ${item.dateLabel.slice(item.dateLabel.indexOf("("))}`;
  const KindIcon = item.kind === CheckKind.CALL ? PhoneIcon : MapPinIcon;

  return (
    <Dialog open onClose={onClose} labelledBy={titleId}>
      <div className="flex flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-3 pr-9">
          <p>
            <span className={`inline-flex rounded-full px-3 py-1.5 text-label-15 ${resultTone(item)}`}>
              {item.resultLabel}
            </span>
          </p>
          <h2 id={titleId} className="text-heading-24 text-text-primary">
            {longDate}
          </h2>
          <p className="flex items-center gap-1.5 text-body-16 text-text-supporting">
            <KindIcon className="size-5" />
            {CHECK_KIND_DETAIL_LABEL[item.kind]}
          </p>
        </div>

        {summary ? (
          <>
            <section className="flex flex-col gap-3">
              <p>
                <span className="inline-flex rounded-sm bg-status-warning-subtle px-2.5 py-2 text-label-14 text-status-warning">
                  {SUBJECT_INFORMATION_LABELS.CONVERSATION_SUMMARY}
                </span>
              </p>
              <p className="text-body-16 text-text-primary">{summary.text}</p>
              <EvidenceLabel label={summary.source.label} />
            </section>
            {summary.ongoingItems.length > 0 && (
              <section className="flex flex-col gap-3">
                <h3 className="text-label-15 text-text-secondary">
                  {SUBJECT_INFORMATION_LABELS.IN_PROGRESS}
                </h3>
                <ul className="list-disc space-y-2 ps-6 text-body-16 text-text-primary">
                  {summary.ongoingItems.map((entry) => (
                    <li key={`${entry.source.checkEventId}-${entry.text}`}>
                      {entry.text}
                      <EvidenceLabel label={entry.source.label} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : item.memo ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-label-15 text-text-secondary">
              {SUBJECT_INFORMATION_LABELS.RECORD_MEMO}
            </h3>
            <p className="text-body-16 text-text-primary">{item.memo}</p>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
