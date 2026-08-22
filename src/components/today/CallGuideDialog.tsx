"use client";

import { useId } from "react";
import { Dialog } from "@/components/Dialog";
import { ConversationSuggestions } from "@/components/today/ConversationSuggestions";
import { PhoneIcon } from "@/components/today/icons";
import { SubjectSummary } from "@/components/today/SubjectSummary";
import { useSubjectBriefing } from "@/components/today/useSubjectBriefing";
import {
  CALL_GUIDE_QUESTIONS,
  CALL_GUIDE_QUESTION_EMPHASIS,
  type RiskGrade,
} from "@/lib/domain";

/**
 * 전화 안내 다이얼로그 — 걸기 직전에 "누구에게, 무엇을 물을지"를 한 화면에 보여 준다.
 * 화면 설계: Figma 38:4993
 *
 * 껍데기·접근성은 공용 `Dialog`가 맡는다. 여기는 내용만 만든다.
 * 등급 칩 문구는 Figma의 `심각/경계/주의`가 아니라 `GRADE_LABEL`을 쓴다 —
 * `주의`가 경보 단계 이름과 겹치기 때문이다 (ADR-0014, AGENTS.md 도메인 규칙 2).
 */

interface Props {
  open: boolean;
  onClose: () => void;
  subjectId: string;
  name: string;
  age: number;
  livesAlone: boolean;
  grade: RiskGrade;
  phone: string | null;
  /** 도로명이 있으면 도로명, 없으면 지번 — 상세 화면과 같은 규칙 */
  address: string;
  /** 기본은 폭염 질문. 경보 종류가 늘면 넣는 쪽이 갈아 끼운다 */
  questions?: readonly string[];
  /** `전화하기`를 눌러 실제로 걸기 시작했을 때 — 통화 결과 시트로 넘어갈 신호 */
  onCallPlaced?: () => void;
}

export function CallGuideDialog({
  open,
  onClose,
  subjectId,
  name,
  age,
  livesAlone,
  grade,
  phone,
  address,
  questions = CALL_GUIDE_QUESTIONS,
  onCallPlaced,
}: Props) {
  const nameId = useId();
  const { briefing } = useSubjectBriefing(subjectId, open);
  const suggestions = questions === CALL_GUIDE_QUESTIONS
    ? briefing?.conversationSuggestions ?? []
    : [];

  const cta =
    "mt-6 flex h-14 w-full items-center justify-center gap-[9px] rounded-lg text-heading-19";

  return (
    <Dialog open={open} onClose={onClose} labelledBy={nameId}>
      <div className="flex flex-col px-6 pt-5 pb-5">
        <SubjectSummary
          nameId={nameId}
          name={name}
          age={age}
          livesAlone={livesAlone}
          grade={grade}
          phone={phone}
          address={address}
        />

        <div className="mt-4 flex flex-col gap-[17px] rounded-[10px] border border-border-default p-6">
          <p className="text-body-15 text-text-secondary">
            이런 내용 물어보면 좋아요
          </p>
          <ul className="flex list-disc flex-col gap-[11px] ps-6">
            {questions.map((question, index) => (
              <li key={question} className="text-body-16 text-text-primary">
                <EmphasizedQuestion
                  question={question}
                  emphasis={
                    questions === CALL_GUIDE_QUESTIONS
                      ? CALL_GUIDE_QUESTION_EMPHASIS[index]
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
          <ConversationSuggestions suggestions={suggestions} />
        </div>

        {phone ? (
          <a
            href={`tel:${phone}`}
            onClick={onCallPlaced}
            className={`${cta} bg-action-primary text-text-inverse active:bg-action-primary-strong`}
          >
            <PhoneIcon className="size-[21px]" />
            전화하기
          </a>
        ) : (
          // 번호가 없다는 사실도 정보다 — 누를 수 없는 버튼으로 남긴다 (SubjectCard와 같은 처리)
          <span
            aria-disabled="true"
            className={`${cta} bg-surface-soft text-text-secondary`}
          >
            <PhoneIcon className="size-[21px]" />
            번호 없음
          </span>
        )}
      </div>
    </Dialog>
  );
}

function EmphasizedQuestion({
  question,
  emphasis,
}: {
  question: string;
  emphasis?: string;
}) {
  if (!emphasis) return question;
  const start = question.indexOf(emphasis);
  if (start < 0) return question;
  const end = start + emphasis.length;
  return (
    <>
      {question.slice(0, start)}
      <strong className="font-bold">{question.slice(start, end)}</strong>
      {question.slice(end)}
    </>
  );
}
