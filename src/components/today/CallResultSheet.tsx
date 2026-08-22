"use client";

import { useId, useState, type ReactNode } from "react";
import { Dialog } from "@/components/Dialog";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  PaperclipIcon,
  PhoneOffIcon,
  XIcon,
} from "@/components/today/icons";
import { SubjectSummary } from "@/components/today/SubjectSummary";
import {
  CallResult,
  CALL_RECORDING_LABELS,
  CALL_RESULT_LABEL,
  CoolingStatus,
  COOLING_STATUS_LABEL,
  type RiskGrade,
} from "@/lib/domain";

/**
 * 통화 결과 풀스크린 시트 — 통화가 끝나고 앱으로 돌아오면 뜬다 (FR-5).
 * 화면 설계: Figma 99:1267 · 음성 파일 첨부는 163:3468(선택 상태 164:9043)
 *
 * 껍데기·접근성은 공용 `Dialog`(placement="fullscreen")가 맡는다. 여기는 내용만 만든다.
 * 버튼 문구는 `CALL_RESULT_LABEL`을 그대로 쓴다 — 아래 아이콘·색은 부연일 뿐
 * 결과값의 의미를 새로 만들지 않는다 (AGENTS.md 도메인 규칙 2).
 *
 * 저장 자체는 `onSave`를 받은 쪽이 한다. 여기는 누른 결과·메모를 모아 넘기고,
 * 저장이 실패하면 이유를 그대로 보여 주며 시트를 닫지 않는다.
 */

interface Option {
  value: CallResult;
  /** 고르지 않았을 때의 아이콘 색 — 고르면 남색 위 흰색으로 덮인다 */
  tone: string;
  icon: ReactNode;
}

const ICON = "size-6";

/** Figma 30:2748의 배치 순서 — 왼쪽 위부터 시계 방향이 아니라 행 단위다 */
const OPTIONS: Option[] = [
  {
    value: CallResult.OK,
    tone: "text-status-success",
    icon: <CheckIcon className={ICON} />,
  },
  {
    value: CallResult.SYMPTOM,
    tone: "text-status-warning",
    icon: <AlertTriangleIcon className={ICON} />,
  },
  {
    value: CallResult.NO_ANSWER,
    tone: "text-icon-default",
    icon: <PhoneOffIcon className={ICON} />,
  },
  {
    value: CallResult.EMERGENCY_119,
    tone: "text-status-critical",
    icon: <AlertCircleIcon className={ICON} />,
  },
];

const COOLING_OPTIONS = Object.values(CoolingStatus);

interface Props {
  open: boolean;
  onClose: () => void;
  name: string;
  age: number;
  livesAlone: boolean;
  grade: RiskGrade;
  phone: string | null;
  address: string;
  /**
   * 고른 결과와 메모를 넘긴다. 저장(서버 기록)은 받는 쪽이 한다.
   * 실패하면 던진다 — 시트가 그 문구를 그대로 보여 준다.
   */
  onSave: (
    result: CallResult,
    coolingStatus: CoolingStatus,
    memo: string,
  ) => void | Promise<void>;
}

export function CallResultSheet({
  open,
  onClose,
  name,
  age,
  livesAlone,
  grade,
  phone,
  address,
  onSave,
}: Props) {
  const nameId = useId();
  const memoId = useId();
  const [result, setResult] = useState<CallResult | null>(null);
  const [coolingStatus, setCoolingStatus] = useState<CoolingStatus | null>(null);
  const [memo, setMemo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  /**
   * 첨부한 통화 음성 파일 이름. 파일 자체는 아무 데도 가지 않는다 — 아래 섹션 주석 참고.
   * `useState` 호출 순서의 맨 뒤에 둔다: 앞에 끼우면 훅을 순서로 흉내 내는 테스트가 어긋난다.
   */
  const [recording, setRecording] = useState<string | null>(null);

  async function save() {
    if (result === null || coolingStatus === null || pending) return;
    setPending(true);
    setError("");
    try {
      await onSave(result, coolingStatus, memo.trim());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "기록하지 못했습니다.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      placement="fullscreen"
      labelledBy={nameId}
    >
      <div className="flex flex-col gap-5 px-5 pt-1 pb-8">
        <SubjectSummary
          nameId={nameId}
          name={name}
          age={age}
          livesAlone={livesAlone}
          grade={grade}
          phone={phone}
          address={address}
        />

        <section className="flex flex-col gap-5 pt-3">
          <h2 className="text-heading-18 text-text-subtle">통화 어땠나요?</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {OPTIONS.map((option) => {
              const selected = option.value === result;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  disabled={pending}
                  onClick={() => setResult(option.value)}
                  /*
                    고른 칸은 남색으로 채우고 글자·아이콘을 흰색으로 뒤집는다 (Figma ⑥ 38:3807).
                    테두리는 굵기를 바꾸지 않는다 — 1px이라도 움직이면 방금 누른 자리가 흔들려
                    60대 사용자 기준에서 오탭 사고가 난다.
                  */
                  className={`flex h-[86px] flex-col items-center justify-center gap-[5px] rounded-lg border border-border-soft text-title-17 ${
                    selected
                      ? "bg-action-primary text-text-inverse"
                      : "bg-surface-default text-text-secondary"
                  }`}
                >
                  <span className={selected ? "text-text-inverse" : option.tone}>
                    {option.icon}
                  </span>
                  {CALL_RESULT_LABEL[option.value]}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-5 pt-3">
          <h2 className="text-heading-18 text-text-subtle">
            냉방기 설비 상태 점검
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {COOLING_OPTIONS.map((option) => {
              const selected = option === coolingStatus;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  disabled={pending}
                  onClick={() => setCoolingStatus(option)}
                  className={`flex h-12 items-center justify-center rounded-lg border border-border-soft text-label-16 ${
                    selected
                      ? "bg-action-primary text-text-inverse"
                      : "bg-surface-default text-text-secondary"
                  }`}
                >
                  {COOLING_STATUS_LABEL[option]}
                </button>
              );
            })}
          </div>
        </section>

        {/*
          ⚠️ 화면만 있고 저장은 없다 (Figma 163:3468 · 선택 상태 164:9043).

          통화 음성은 어르신의 육성이라 저장하려면 저장소·전사 도입과 개인정보 경계를 새로 정하는
          ADR이 먼저다 — ADR-0024가 정한 경계는 텍스트 메모까지다. 고른 파일 이름은 이 시트 안에만
          남고 `저장하기`로 서버에 올라가지 않는다. 저장된 것으로 오해하지 않도록 안내한다
          (ADR-0014 결과 9).
        */}
        <section className="flex flex-col gap-5 pt-3">
          <h2 className="text-heading-18 text-text-subtle">
            {CALL_RECORDING_LABELS.SECTION}
          </h2>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border-soft p-4">
            <div className="flex w-full items-center justify-center gap-2">
              {/* 누르는 자리를 상자 폭 전체로 넓힌다 — 아이콘+글자만큼이면 60대 기준에서 좁다 */}
              <label className="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 py-3 text-label-16 text-text-secondary">
                <PaperclipIcon className="size-4 shrink-0" />
                <span className="min-w-0 break-all">
                  {recording ?? CALL_RECORDING_LABELS.EMPTY}
                </span>
                {/*
                  `key`가 파일 이름을 따라간다 — 첨부를 지우면 입력이 새로 붙어 값이 비워진다.
                  같은 파일을 다시 골라도 change가 오게 하려면 값이 남아 있으면 안 된다.
                */}
                <input
                  key={recording ?? ""}
                  type="file"
                  accept="audio/*"
                  disabled={pending}
                  onChange={(event) =>
                    setRecording(event.target.files?.[0]?.name ?? null)
                  }
                  className="sr-only"
                />
              </label>
              {recording !== null && (
                <button
                  type="button"
                  aria-label={CALL_RECORDING_LABELS.REMOVE}
                  disabled={pending}
                  onClick={() => setRecording(null)}
                  /* 글리프는 Figma대로 작지만 누르는 자리는 44px다 (ADR-0014 접근성) */
                  className="flex size-11 shrink-0 items-center justify-center text-icon-secondary"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>
            <p className="text-center text-body-14 text-text-tertiary">
              {CALL_RECORDING_LABELS.GUIDE}
            </p>
            <p className="text-center text-body-14 text-status-warning-strong">
              {CALL_RECORDING_LABELS.NOT_SAVED}
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-5 pt-3">
          <label htmlFor={memoId} className="text-heading-18 text-text-subtle">
            메모 (선택)
          </label>
          {/*
            자리 표시 글자색은 Figma의 `action/disabled`(#c6cfda, 흰 배경 대비 1.55:1) 대신
            `text-tertiary`(4.83:1)다. 그 대비로는 예시 문장이 보이지 않는다 (PRD §9).
          */}
          <input
            id={memoId}
            type="text"
            value={memo}
            disabled={pending}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="목소리가 기운 없으심"
            className="h-12 w-full rounded-lg border border-border-soft px-4 text-body-15 text-text-primary placeholder:text-text-tertiary"
          />
        </section>

        {/* 결과를 고르기 전에는 저장할 것이 없다 — 빈 기록이 남지 않게 막는다 */}
        <button
          type="button"
          disabled={result === null || coolingStatus === null || pending}
          onClick={save}
          className={`flex h-14 w-full items-center justify-center rounded-lg text-heading-19 ${
            result === null || coolingStatus === null || pending
              ? "bg-surface-soft text-text-secondary"
              : "bg-action-primary text-text-inverse active:bg-action-primary-strong"
          }`}
        >
          {pending ? "저장 중…" : "저장하기"}
        </button>

        {/*
          실패 문구는 버튼 *아래*에 붙인다. 위에 끼우면 오류가 뜨는 순간 버튼이 밀려
          방금 누르려던 자리가 바뀐다 — 60대 사용자 기준에서 오탭 사고다 (ADR-0014).
        */}
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-[10px] border border-status-critical bg-status-critical-subtle px-4 py-3 text-body-15-relaxed text-status-critical-strong"
          >
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
