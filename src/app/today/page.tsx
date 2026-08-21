import { getBoard, type BoardSubject } from "@/lib/board/today";
import { RecordButton } from "@/components/today/RecordButton";
import { AlertLevel, CheckKind, RiskGrade } from "@/lib/domain";

/**
 * 담당자(생활지원사) 오늘의 대응 보드 — FR-4, PRD F3
 *
 * 60대 사용자 기준 제약(PRD §9)을 화면 구조로 강제한다:
 *  - 큰 글자 (이름 3xl, 본문 lg 이상)
 *  - 화면당 결정 1개 — 카드마다 결정은 "이 가구를 지금 어떻게 할 것인가" 하나뿐
 *  - 어떤 기록도 탭 2회 이내 (RecordButton)
 *
 * 비경보일에는 아무것도 보여주지 않는다. 평소에 조용한 것이 이 제품의 스펙이다(PRD §9).
 */
export const dynamic = "force-dynamic";

const LEVEL_STYLE: Record<AlertLevel, string> = {
  [AlertLevel.ADVISORY]: "bg-amber-500",
  [AlertLevel.WARNING]: "bg-orange-600",
  [AlertLevel.EMERGENCY]: "bg-red-700",
};

const GRADE_STYLE: Record<RiskGrade, { card: string; badge: string }> = {
  [RiskGrade.CRITICAL]: {
    card: "border-red-300 bg-red-50",
    badge: "bg-red-700 text-white",
  },
  [RiskGrade.HIGH]: {
    card: "border-orange-200 bg-orange-50",
    badge: "bg-orange-600 text-white",
  },
  [RiskGrade.MODERATE]: {
    card: "border-zinc-200 bg-white",
    badge: "bg-zinc-600 text-white",
  },
};

function SubjectCard({ subject, date }: { subject: BoardSubject; date: string }) {
  const style = GRADE_STYLE[subject.grade];

  // 처리 끝난 가구는 접어서 남은 일에 집중하게 한다
  if (!subject.open) {
    return (
      <li className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4">
        <span className="text-xl font-bold text-zinc-500 line-through">
          {subject.name}
        </span>
        <span className="rounded-full bg-zinc-200 px-4 py-1 text-lg font-semibold text-zinc-700">
          {subject.statusLabel}
        </span>
      </li>
    );
  }

  return (
    <li className={`rounded-2xl border-2 p-5 ${style.card}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-3xl font-bold">{subject.name}</h3>
        <span className={`rounded-full px-4 py-1 text-lg font-semibold ${style.badge}`}>
          {subject.statusLabel}
        </span>
      </div>

      {/* 위험 사유는 스코어링 엔진이 준 문자열 그대로 (설명 가능성 — AGENTS.md 도메인 규칙 3) */}
      <ul className="mt-3 space-y-1">
        {subject.reasons.map((reason) => (
          <li key={reason} className="text-lg leading-7 text-zinc-700">
            · {reason}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-lg text-zinc-500">{subject.address}</p>

      <div className="mt-5 flex flex-col gap-3">
        {subject.phone && subject.nextCheckKind === CheckKind.CALL && (
          <a
            href={`tel:${subject.phone}`}
            className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-zinc-900 text-xl font-bold"
          >
            {subject.phone}로 전화 걸기
          </a>
        )}
        <RecordButton
          subjectId={subject.subjectId}
          name={subject.name}
          kind={subject.nextCheckKind}
          date={date}
        />
      </div>
    </li>
  );
}

export default async function TodayPage(props: PageProps<"/today">) {
  const params = await props.searchParams;
  const date = typeof params.date === "string" ? params.date : undefined;
  const workerId = typeof params.workerId === "string" ? params.workerId : undefined;
  const board = await getBoard({ date, workerId });

  if (!board.alerted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-6xl">☀️</p>
        <h1 className="text-3xl font-bold">오늘은 경보가 없습니다</h1>
        <p className="max-w-sm text-xl leading-8 text-zinc-500">
          폭염·한파 경보가 내려진 날에만 확인할 가구를 알려드립니다.
        </p>
        <p className="mt-4 text-lg text-zinc-400">{board.date}</p>
      </main>
    );
  }

  return (
    <main className="flex-1 px-5 py-6">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-5 py-1.5 text-2xl font-bold text-white ${LEVEL_STYLE[board.level]}`}
          >
            {board.levelLabel}
          </span>
          <span className="text-xl text-zinc-500">
            체감 {board.feelsLikeMax}도 · {board.date}
          </span>
        </div>

        <p className="mt-5 text-3xl font-bold leading-10">
          오늘 확인할 가구{" "}
          <span className="text-red-700">{board.summary.open}</span>
          <span className="text-zinc-400"> / {board.summary.total}</span>
        </p>
        {board.summary.openCritical > 0 && (
          <p className="mt-2 text-xl font-semibold text-red-700">
            이 중 1등급 {board.summary.openCritical}가구는 전화 없이 바로 방문입니다
          </p>
        )}
      </header>

      <div className="flex flex-col gap-10">
        {board.groups.map((group) => (
          <section key={group.grade}>
            <h2 className="mb-4 text-2xl font-bold">
              {group.gradeLabel}
              <span className="ml-2 text-xl font-normal text-zinc-500">
                {group.plan} · {group.subjects.length}가구
              </span>
            </h2>
            <ul className="flex flex-col gap-4">
              {group.subjects.map((subject) => (
                <SubjectCard
                  key={subject.subjectId}
                  subject={subject}
                  date={board.date}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
