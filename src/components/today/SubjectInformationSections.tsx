import Image from "next/image";
import type {
  SubjectDetail,
  SubjectHistoryItem,
} from "@/lib/board/subject";
import {
  GRADE_LABEL,
  VISIT_CHECKLIST,
  VisitResult,
} from "@/lib/domain";

/** 직전 경보일부터 위험 단계가 올라갔을 때만 보이는 안내 (Figma 125:6198). */
export function GradeChangeNotice({ detail }: { detail: SubjectDetail }) {
  if (!detail.gradeChange) return null;

  // 상승 사실만 알린다. 원인을 임의로 단정하지 않고 바로 아래의 스코어링 reasons를 그대로 보여 준다.
  return (
    <section className="flex items-center rounded-xl bg-status-critical-subtle p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-status-critical-strong">
            <Image
              src="/icons/visit/arrow-up-inverse.svg"
              alt=""
              width={10}
              height={12}
            />
          </span>
          <h2 className="text-label-16 text-status-critical-strong">
            오늘 위험 단계가 올라갔어요
          </h2>
        </div>
        <p className="text-body-15 text-text-secondary">
          {GRADE_LABEL[detail.gradeChange.previousGrade]} →{" "}
          {GRADE_LABEL[detail.gradeChange.currentGrade]}으로 상향됐어요
        </p>
      </div>
    </section>
  );
}

/** 현장에서 놓치기 쉬운 항목을 도메인 상수 순서 그대로 보여 준다. */
export function VisitChecklist() {
  return (
    <section className="flex flex-col gap-4 rounded-[10px] border border-border-default bg-surface-default p-6">
      <h2 className="text-label-15 text-text-secondary">방문 체크리스트</h2>
      <ul className="flex flex-col gap-2.5 text-body-16 text-text-primary">
        {VISIT_CHECKLIST.map((item) => (
          <li key={item.emphasis} className="flex items-start gap-2">
            <span aria-hidden className="shrink-0">
              -
            </span>
            {/* 굵게 읽을 자리는 domain.ts가 정한다 (Figma 167:10191) */}
            <span>
              <strong className="text-label-16">{item.emphasis}</strong>
              {item.rest}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function historyMarker(item: SubjectHistoryItem, isLast: boolean): string {
  // 그날 대응이 매끄럽지 않았던 기록만 주황 표식 (Figma 113:2297의 `에어컨 고장 확인`)
  if (
    item.result === VisitResult.AIRCON_ISSUE ||
    item.result === VisitResult.SYMPTOM ||
    item.result === VisitResult.EMERGENCY_119
  ) {
    return "/icons/visit/timeline-warning.svg";
  }
  return isLast
    ? "/icons/visit/timeline-last.svg"
    : "/icons/visit/timeline.svg";
}

/**
 * 최근 전화·방문 기록 3건을 Figma 타임라인 형태로 표시한다.
 *
 * 카드 안(방문하기, Figma 164:8213)과 탭 안(대상자 정보, Figma 164:7693)은 글자 크기가 다르다 —
 * 탭에서는 이 목록이 화면의 본문이라 한 단계씩 크다. 두 배치의 값은 아래 `SCALE`에만 둔다.
 */
const SCALE = {
  card: { date: "text-label-16", kind: "text-body-15", result: "text-body-16", row: "pb-3" },
  tab: { date: "text-title-17", kind: "text-label-16", result: "text-body-18", row: "pb-6" },
} as const;

export function VisitHistory({
  items,
  embedded = false,
  onSelect,
}: {
  items: SubjectHistoryItem[];
  /** 대상자 정보의 탭 안에서는 바깥 카드·중복 제목을 생략한다. */
  embedded?: boolean;
  onSelect?: (item: SubjectHistoryItem) => void;
}) {
  const scale = embedded ? SCALE.tab : SCALE.card;
  return (
    <section
      className={
        embedded
          ? "flex flex-col gap-4 overflow-hidden bg-surface-default pt-1"
          : "flex flex-col gap-4 overflow-hidden rounded-[14px] border border-border-default bg-surface-default p-6"
      }
    >
      {!embedded && (
        <h2 className="text-label-15 text-text-secondary">방문 히스토리</h2>
      )}
      {items.length === 0 ? (
        <p className="text-body-15 text-text-secondary">
          최근 확인 기록이 없습니다.
        </p>
      ) : (
        <ol className="flex flex-col">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.id} className="flex min-h-[46px] gap-2.5">
                <Image
                  src={historyMarker(item, isLast)}
                  alt=""
                  width={18}
                  height={isLast ? 46 : 58}
                  className="h-full min-h-[46px] w-[18px] shrink-0 self-stretch"
                />
                <button
                  type="button"
                  disabled={!onSelect}
                  onClick={() => onSelect?.(item)}
                  className={`min-w-0 flex-1 text-left text-body-14 text-text-primary disabled:cursor-default ${scale.row}`}
                >
                  <p className="flex items-center gap-2">
                    <strong className={scale.date}>{item.dateLabel}</strong>
                    <span className={`${scale.kind} text-text-secondary`}>
                      {item.kindLabel}
                    </span>
                    {onSelect && (
                      <Image
                        src="/figma/chevron-right.svg"
                        alt=""
                        width={20}
                        height={20}
                      />
                    )}
                  </p>
                  <p className={`mt-1 break-words ${scale.result}`}>
                    {item.resultLabel}
                  </p>
                  {item.memo && (
                    <p className="mt-1 break-words text-body-14 text-text-secondary">
                      {item.memo}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
