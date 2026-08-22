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
  [RiskGrade.CRITICAL]: "bg-status-critical text-text-inverse",
  [RiskGrade.HIGH]: "bg-status-warning text-text-primary",
  [RiskGrade.MODERATE]: "bg-status-neutral text-text-primary",
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
              className={`flex min-h-12 flex-1 items-center justify-center px-3 py-2 text-body-16 ${
                active
                  ? "border-b-2 border-action-primary-strong font-bold text-text-primary"
                  : "border-b border-border-default text-text-primary"
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
                  className={`rounded-full px-3.5 py-1 text-label-16-compact ${GRADE_CHIP[group.grade]}`}
                >
                  {group.gradeLabel}
                </span>
                {/*
                  등급 색은 칩이 전달한다. 설명까지 등급색으로 쓰면 새 background/subtle에서
                  2등급 4.45:1, 3등급 4.23:1로 WCAG AA(일반 텍스트 4.5:1)에 못 미친다.
                */}
                <span className="text-title-17 text-text-primary">
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
