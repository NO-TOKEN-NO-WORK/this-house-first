import { notFound } from "next/navigation";
import { KakaoMap } from "@/components/map/KakaoMap";
import { BottomNav } from "@/components/today/BottomNav";
import { isIsoDate } from "@/lib/board/format";
import { getBoard } from "@/lib/board/today";
import { toMapBuildings } from "@/lib/map/data";

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
  const buildings = toMapBuildings(board);

  return (
    <>
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-5 bg-background-subtle px-5 pt-11 pb-[100px]">
        <header>
          <h1 className="text-heading-24 text-text-primary">담당 가구 지도</h1>
          <p className="text-body-16 text-text-secondary">
            {board.dateLabel}{board.dong ? ` · ${board.dong}` : ""}
          </p>
        </header>
        <KakaoMap
          apiKey={process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}
          buildings={buildings}
          date={board.date}
          workerId={workerId}
        />
      </main>
      <BottomNav current="map" date={date} workerId={workerId} />
    </>
  );
}
