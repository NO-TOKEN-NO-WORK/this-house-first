import { notFound } from "next/navigation";
import { BottomNav } from "@/components/today/BottomNav";
import { GradeFilter } from "@/components/today/GradeFilter";
import { SubjectCard } from "@/components/today/SubjectCard";
import { TodayAppSettings } from "@/components/today/TodayAppSettings";
import { TodayWorkspace } from "@/components/today/TodayWorkspace";
import { AlertCircleIcon } from "@/components/today/icons";
import { CurrentWeatherSummary } from "@/components/CurrentWeatherSummary";
import {
  type AlertedBoard,
  getBoard,
  type SilentBoard,
} from "@/lib/board/today";
import { isIsoDate } from "@/lib/board/format";
import {
  AlertLevel,
  GRADE_LABEL,
  isRiskGrade,
  RiskGrade,
} from "@/lib/domain";

/**
 * 담당자(생활지원사) 오늘의 대응 보드 — FR-4, PRD F3
 * 화면 설계: Figma ① 25:4(경보일) · ①-b 14:2926(비경보일)
 *
 * 60대 사용자 기준 제약(PRD §9)을 화면 구조로 강제한다:
 *  - 큰 글자 (이름 24px, 본문 15px 이상)
 *  - 화면당 결정 1개 — 카드마다 결정은 "이 가구를 지금 어떻게 할 것인가" 하나뿐
 *  - 어떤 기록도 탭 2회 이내 — 카드 버튼(1) → 상세의 결과 버튼(2)
 *
 * 경보가 없는 날에는 위험 단계도 순서도 없이 담당 가구만 보여준다. 알림은 여전히 0건이다(PRD §9).
 */
export const dynamic = "force-dynamic";

/**
 * 위험 단계 요약 글자색 (Figma ① 25:36~25:44).
 *
 * 경계만 Figma와 다르다 — 디자인의 `status/warning`(#f29900)은 흰 배경에서 대비 2.25:1로
 * 20px 굵은 글자 기준(3:1)에도 못 미친다. 한 단계 진한 `-strong`(#9a6200, 5.09:1)을 쓴다.
 * 60대 사용자 기준 접근성(PRD §9) — ADR-0014의 칩 글자색 예외와 같은 이유다.
 */
const GRADE_TEXT: Record<RiskGrade, string> = {
  [RiskGrade.CRITICAL]: "text-status-critical",
  [RiskGrade.HIGH]: "text-status-warning-strong",
  [RiskGrade.MODERATE]: "text-text-supporting",
};

const GRADE_ORDER: readonly RiskGrade[] = [
  RiskGrade.CRITICAL,
  RiskGrade.HIGH,
  RiskGrade.MODERATE,
];

function Greeting({
  workerName,
  dateLabel,
  dong,
}: {
  workerName: string | null;
  dateLabel: string;
  dong: string | null;
}) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-heading-24 text-text-primary">
        {workerName ? `어서오세요 ${workerName}님` : "어서오세요"}
      </h1>
      <p className="text-body-16 text-text-primary">
        {dateLabel}
        {dong ? ` · ${dong}` : ""}
      </p>
    </header>
  );
}

/**
 * 비상 단계 배너 (Figma 38:4482 · 이전 판 25:4) — ADR-0019.
 *
 * 주의·경계 단계에서는 색이 바뀌는 게 아니라 배너 자체가 없다 (Figma 133:3213).
 * 매 경보일 떠 있는 띠는 곧 배경이 되므로 "오늘은 평소와 다르다"는 신호는 최고 단계에만
 * 남긴다 — 낮은 단계에서 무엇부터 할지는 아래 요약·위험 단계 필터가 이미 말해 준다(PRD §9).
 */
function EmergencyBanner({ board }: { board: AlertedBoard }) {
  if (board.level !== AlertLevel.EMERGENCY) return null;
  return (
    <p className="flex w-full items-center gap-2.5 rounded-full bg-status-critical px-4.5 py-3 text-label-18 text-text-inverse">
      <AlertCircleIcon className="size-6 shrink-0" />
      <span>
        오늘 폭염 {board.levelLabel} 단계예요 · 체감 {board.feelsLikeMax}°C
      </span>
    </p>
  );
}

/** 요약 카드 — 왼쪽은 "오늘 끝낸 일", 오른쪽은 위험 단계별 미처리 수 (Figma ① 25:30) */
function SummaryCard({ board }: { board: AlertedBoard }) {
  return (
    <div className="flex w-full items-center rounded-[10px] border border-border-default bg-surface-default px-8 py-4.5">
      <div className="flex flex-1 items-center justify-between">
        <div className="flex h-11.5 flex-col items-center justify-between text-text-primary">
          <span className="text-body-15">확인 완료</span>
          <span className="text-heading-20">
            {board.summary.total - board.summary.open} / {board.summary.total}
          </span>
        </div>
        <div aria-hidden className="h-6 w-px bg-border-default" />
        {GRADE_ORDER.map((grade) => (
          <div
            key={grade}
            className={`flex h-11.5 flex-col items-center justify-between ${GRADE_TEXT[grade]}`}
          >
            <span className="text-body-15">{GRADE_LABEL[grade]}</span>
            <span className="text-heading-20">
              {board.summary.openByGrade[grade]}명
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 비경보일 (Figma ①-b) — 위험 단계도 순서도 없이 담당 가구만 */
function SilentBoardView({
  board,
  workerId,
}: {
  board: SilentBoard;
  workerId?: string;
}) {
  return (
    <>
      <div className="flex w-full items-center justify-between rounded-[10px] border border-border-default bg-surface-default px-8 py-4.5">
        <span className="text-label-15 text-text-secondary">담당 가구</span>
        <span className="text-heading-20 text-text-primary">
          {board.subjects.length}가구
        </span>
      </div>
      <p className="text-body-15-relaxed text-text-secondary">
        오늘은 경보가 없습니다. 폭염·한파 경보가 내려지면 누구부터 확인할지
        순서를 정해 드립니다.
      </p>
      <ul className="flex flex-col gap-4">
        {board.subjects.map((subject) => (
          <SubjectCard
            key={subject.subjectId}
            subject={subject}
            nextCheckKind={null}
            callOnly
            date={board.date}
            workerId={workerId}
          />
        ))}
      </ul>
    </>
  );
}

export default async function TodayPage(props: PageProps<"/today">) {
  const params = await props.searchParams;
  let date: string | undefined;
  if (params.date !== undefined) {
    if (!isIsoDate(params.date)) notFound();
    date = params.date;
  }
  const workerId =
    typeof params.workerId === "string" ? params.workerId : undefined;
  const gradeValue = typeof params.grade === "string" ? Number(params.grade) : null;
  const selectedGrade = isRiskGrade(gradeValue) ? gradeValue : null;
  const board = await getBoard({ date, workerId });

  return (
    <TodayWorkspace
      board={board}
      workerId={workerId}
      returnGrade={selectedGrade}
    >
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-8 bg-surface-default px-5 pt-[calc(--spacing(11)_+_var(--safe-top))] pb-[calc(100px_+_var(--safe-bottom))]">
        <div className="flex flex-col gap-5">
          <Greeting
            workerName={board.worker?.name ?? null}
            dateLabel={board.dateLabel}
            dong={board.dong}
          />
          <CurrentWeatherSummary variant="today" />
          {board.alerted ? (
            <div className="flex flex-col gap-3">
              <EmergencyBanner board={board} />
              <SummaryCard board={board} />
            </div>
          ) : null}
        </div>

        {board.alerted ? (
          <GradeFilter
            key={selectedGrade ?? "all"}
            groups={board.groups}
            initialGrade={selectedGrade}
            date={board.date}
            workerId={workerId}
          />
        ) : (
          <SilentBoardView board={board} workerId={workerId} />
        )}

        <TodayAppSettings
          workerId={board.worker?.id}
          publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? ""}
        />
      </main>
      <BottomNav current="today" date={date} workerId={workerId} />
    </TodayWorkspace>
  );
}
