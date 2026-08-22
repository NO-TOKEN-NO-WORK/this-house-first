import { MapPinIcon, PhoneIcon } from "@/components/today/icons";
import { GRADE_CHIP } from "@/components/today/gradeStyles";
import { GRADE_LABEL, type RiskGrade } from "@/lib/domain";

/**
 * 대상자 머리글 — 등급 칩 · 이름/나이 · 연락처.
 * 전화 안내 다이얼로그(Figma ④ 7:2578)·통화 결과 시트(⑤ 7:2489)·방문 화면(25:347)이
 * 같은 블록을 쓴다.
 *
 * 칩 문구는 Figma의 `심각`이 아니라 `GRADE_LABEL`이다 —
 * `주의`가 경보 단계 이름과 겹치기 때문이다 (ADR-0014, AGENTS.md 도메인 규칙 2).
 */
export interface SubjectSummaryProps {
  /** 다이얼로그 이름으로 쓰이도록 이름 줄에 붙일 id */
  nameId?: string;
  name: string;
  age: number;
  livesAlone: boolean;
  /** 비경보일 정보 화면에는 위험 단계가 없으므로 칩을 생략한다. */
  grade?: RiskGrade | null;
  phone: string | null;
  /** 도로명이 있으면 도로명, 없으면 지번 — 상세 화면과 같은 규칙 */
  address: string;
}

export function SubjectSummary({
  nameId,
  name,
  age,
  livesAlone,
  grade,
  phone,
  address,
}: SubjectSummaryProps) {
  return (
    <div className="flex flex-col gap-3">
      {grade && (
        <span
          className={`self-start rounded-full px-3 py-1.25 text-label-15 ${GRADE_CHIP[grade]}`}
        >
          {GRADE_LABEL[grade]}
        </span>
      )}

      <p id={nameId} className="flex items-baseline gap-2.5">
        <span className="text-display-28 text-text-primary">{name}</span>
        <span className="text-body-18 text-text-secondary">
          {age}세{livesAlone ? " · 독거" : ""}
        </span>
      </p>

      {/*
        Figma(7:2497)는 번호·주소를 반씩 나누지만, 실제 주소는 "대구광역시 서구 비산동 1"처럼
        길어서 반칸에 안 들어간다. 번호는 자리를 고정하고 남는 폭을 주소가 갖게 한다.
      */}
      <div className="flex items-start gap-3 text-body-15 text-text-supporting">
        {phone && (
          <a href={`tel:${phone}`} className="flex shrink-0 items-center gap-2">
            <PhoneIcon className="size-[21px] shrink-0 text-icon-default" />
            {phone}
          </a>
        )}
        <span className="flex min-w-0 flex-1 items-start gap-2">
          <MapPinIcon className="size-[18px] shrink-0 translate-y-0.5 text-icon-default" />
          {address}
        </span>
      </div>
    </div>
  );
}
