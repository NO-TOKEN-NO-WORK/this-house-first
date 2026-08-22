import Link from "next/link";
import { notFound } from "next/navigation";
import { BottomNav } from "@/components/today/BottomNav";
import { isIsoDate } from "@/lib/board/format";
import { getLog } from "@/lib/board/log-read";
import type { LogListItem } from "@/lib/board/log";

/**
 * 담당자 확인 기록 목록 — 하단 탭 `기록`.
 *
 * `/today` PWA scope 안에 둔다 (ADR-0006, start_url·scope 모두 `/today`).
 * 이미 남은 CheckEvent만 보여 준다. 열 때 AlertDay·기록·알림을 만들지 않는다.
 * 비경보일·기록이 없는 날은 빈 상태다 (행을 지어내지 않는다).
 */
export const dynamic = "force-dynamic";

function subjectHref(
  item: LogListItem,
  workerId?: string,
): string {
  const query = new URLSearchParams({ date: item.alertDate });
  if (workerId) query.set("workerId", workerId);
  return `/today/${item.subjectId}?${query.toString()}`;
}

export default async function LogPage(props: PageProps<"/today/log">) {
  const params = await props.searchParams;
  let date: string | undefined;
  if (params.date !== undefined) {
    if (!isIsoDate(params.date)) notFound();
    date = params.date;
  }
  const workerId =
    typeof params.workerId === "string" ? params.workerId : undefined;
  const log = await getLog({ date, workerId });

  return (
    <>
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-8 bg-background-subtle px-5 pt-11 pb-[100px]">
        <header className="flex flex-col gap-1">
          <h1 className="text-heading-24 text-text-primary">기록</h1>
          <p className="text-body-16 text-text-primary">
            {log.worker
              ? `${log.worker.name}님의 확인 기록`
              : "확인 기록"}
          </p>
        </header>

        {log.items.length === 0 ? (
          <section
            className="flex flex-col gap-2 rounded-[10px] border border-border-default bg-surface-default px-8 py-8"
            aria-label="빈 기록"
          >
            <p className="text-heading-20 text-text-primary">
              아직 확인 기록이 없습니다
            </p>
            <p className="text-body-15-relaxed text-text-secondary">
              경보일에 남긴 전화·방문 결과가 여기에 모입니다.
            </p>
          </section>
        ) : (
          <div className="flex flex-col gap-8">
            {log.groups.map((group) => (
              <section key={group.date} className="flex flex-col gap-4">
                <h2 className="text-title-17 text-text-primary">
                  {group.dateLabel}
                </h2>
                <ul className="flex flex-col gap-4">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={subjectHref(item, workerId)}
                        className="flex min-h-12 w-full items-center justify-between gap-4 rounded-[10px] border border-border-default bg-surface-default px-5 py-6"
                      >
                        <span className="text-heading-24 text-text-primary">
                          {item.subjectName}
                        </span>
                        <span className="shrink-0 text-label-16-compact text-text-secondary">
                          {item.kindLabel} · {item.resultLabel}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
      <BottomNav current="log" date={date} workerId={workerId} />
    </>
  );
}
