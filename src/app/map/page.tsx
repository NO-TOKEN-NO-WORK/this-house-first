import { notFound } from "next/navigation";
import { VisitRouteView } from "@/components/map/VisitRouteView";
import { BottomNav } from "@/components/today/BottomNav";
import { isIsoDate } from "@/lib/board/format";
import { getBoard } from "@/lib/board/today";
import { toVisitRoute } from "@/lib/map/route";

export const dynamic = "force-dynamic";

export default async function MapPage(props: PageProps<"/map">) {
  const params = await props.searchParams;
  let date: string | undefined;
  if (params.date !== undefined) {
    if (!isIsoDate(params.date)) notFound();
    date = params.date;
  }
  const workerId =
    typeof params.workerId === "string" ? params.workerId : undefined;
  const board = await getBoard({ date, workerId });
  const route = toVisitRoute(board);
  const routeQuery = new URLSearchParams({ date: board.date });
  if (board.worker) routeQuery.set("workerId", board.worker.id);

  return (
    <>
      <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col gap-3.5 bg-surface-default px-3.5 pt-[calc(--spacing(8)_+_var(--safe-top))] pb-[calc(100px_+_var(--safe-bottom))]">
        <h1 className="text-heading-24 text-text-primary">방문 동선</h1>
        <VisitRouteView
          apiKey={process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}
          initialRoute={route}
          routeApiUrl={`/api/visit-queue?${routeQuery.toString()}`}
        />
      </main>
      <BottomNav current="map" date={date} workerId={workerId} />
    </>
  );
}
