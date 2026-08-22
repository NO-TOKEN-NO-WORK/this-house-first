"use client";

import { useState } from "react";
import type { BoardGroup } from "@/lib/board/today";
import {
  GRADE_LABEL,
  RiskGrade,
  type RiskGrade as RiskGradeValue,
} from "@/lib/domain";
import { SubjectCard } from "./SubjectCard";

const GRADE_CHIP: Record<RiskGradeValue, string> = {
  [RiskGrade.CRITICAL]: "bg-danger text-white",
  [RiskGrade.HIGH]: "bg-warn text-ink",
  [RiskGrade.MODERATE]: "bg-calm text-ink",
};

const GRADE_TEXT: Record<RiskGradeValue, string> = {
  [RiskGrade.CRITICAL]: "text-danger-ink",
  [RiskGrade.HIGH]: "text-warn-ink",
  [RiskGrade.MODERATE]: "text-slate",
};

export function GradeFilter({
  groups,
  initialGrade,
  date,
  workerId,
}: {
  groups: BoardGroup[];
  initialGrade: RiskGradeValue | null;
  date: string;
  workerId?: string;
}) {
  const [selectedGrade, setSelectedGrade] = useState(initialGrade);

  function selectGrade(grade: RiskGradeValue | null) {
    setSelectedGrade(grade);

    const query = new URLSearchParams(window.location.search);
    if (grade === null) query.delete("grade");
    else query.set("grade", String(grade));
    const qs = query.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`,
    );
  }

  return (
    <>
      <nav aria-label="등급 필터" className="flex w-full">
        {[
          { key: "all", label: "전체", grade: null },
          ...groups.map((group) => ({
            key: String(group.grade),
            label: GRADE_LABEL[group.grade],
            grade: group.grade,
          })),
        ].map((tab) => {
          const active = tab.grade === selectedGrade;
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={active}
              onClick={() => selectGrade(tab.grade)}
              className={`flex min-h-12 flex-1 items-center justify-center px-3 py-2 text-base ${
                active
                  ? "border-b-2 border-brand-deep font-bold text-ink"
                  : "border-b border-line text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-8">
        {groups
          .filter(
            (group) =>
              selectedGrade === null || group.grade === selectedGrade,
          )
          .map((group) => (
            <section key={group.grade} className="flex flex-col gap-4">
              <h2 className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3.5 py-1 text-base font-bold ${GRADE_CHIP[group.grade]}`}
                >
                  {group.gradeLabel}
                </span>
                <span
                  className={`text-[17px] font-bold ${GRADE_TEXT[group.grade]}`}
                >
                  {group.subjects.length}명 | {group.plan}
                </span>
              </h2>
              <ul className="flex flex-col gap-4">
                {group.subjects.map((subject) => (
                  <SubjectCard
                    key={subject.subjectId}
                    subject={subject}
                    grade={subject.grade}
                    statusLabel={subject.open ? undefined : subject.statusLabel}
                    nextCheckKind={subject.open ? subject.nextCheckKind : null}
                    date={date}
                    workerId={workerId}
                    returnGrade={selectedGrade ?? undefined}
                  />
                ))}
              </ul>
            </section>
          ))}
      </div>
    </>
  );
}
