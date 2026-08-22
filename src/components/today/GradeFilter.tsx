"use client";

import { useState } from "react";
import type { BoardGroup, BoardSubject } from "@/lib/board/today";
import {
  CheckKind,
  GRADE_LABEL,
  HouseholdStatus,
  RiskGrade,
  type RiskGrade as RiskGradeValue,
} from "@/lib/domain";
import { GRADE_CHIP } from "./gradeStyles";
import { SubjectCard } from "./SubjectCard";

/** 등급별 대응 지시 글자색 (Figma ① 25:60 · 25:104 · 25:127) */
const GRADE_PLAN_TEXT: Record<RiskGradeValue, string> = {
  [RiskGrade.CRITICAL]: "text-status-critical-strong",
  [RiskGrade.HIGH]: "text-status-warning-strong",
  [RiskGrade.MODERATE]: "text-text-tertiary",
};

/**
 * 무응답 1회로 멈춰 있는 가구의 진행 한 줄 — `"무응답 1회 · 9시 10분"` (Figma ⑥ 38:3534).
 *
 * 문구는 `HOUSEHOLD_STATUS_LABEL`이 만든 `statusLabel`을 그대로 쓴다 (도메인 규칙 2).
 * 이 상태에서만 배너를 붙인다 — 다른 상태는 카드가 이미 칩이나 버튼으로 말하고 있다.
 */
function retryNoteOf(subject: BoardSubject): string | undefined {
  if (!subject.open) return undefined;
  if (subject.status !== HouseholdStatus.NO_ANSWER_1) return undefined;
  return subject.lastCheckAtLabel
    ? `${subject.statusLabel} · ${subject.lastCheckAtLabel}`
    : subject.statusLabel;
}

/**
 * 방문으로 오늘 대응이 끝난 가구인가 — 카드가 `방문 완료 기록 보기` 하나만 내민다 (Figma 115:2855).
 *
 * 상태만으로는 못 가른다: `119 연계`는 전화에서도 나오는 종결 상태라 마지막 확인이
 * 무엇이었는지를 함께 본다 (ADR-0020).
 */
function visitRecordedOf(subject: BoardSubject): boolean {
  return !subject.open && subject.lastCheckKind === CheckKind.VISIT;
}

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
      <nav aria-label="위험 단계 필터" className="flex w-full">
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
              className={`flex min-h-12 flex-1 items-center justify-center px-3 py-2 text-body-16 text-text-primary ${
                active
                  ? "border-b-2 border-action-primary-strong"
                  : "border-b border-border-subtle"
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
                  화면 배경이 흰색(Figma 25:4)이 되면서 단계색을 그대로 쓴다 —
                  심각 6.59:1 · 경계 5.09:1 · 주의 4.83:1로 모두 WCAG AA를 넘는다.
                  (배경이 background/subtle이던 판에서는 경계 4.45:1, 주의 4.23:1로 미달이었다)
                */}
                <span className={`text-title-17 ${GRADE_PLAN_TEXT[group.grade]}`}>
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
                    retryNote={retryNoteOf(subject)}
                    visitRecorded={visitRecordedOf(subject)}
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
