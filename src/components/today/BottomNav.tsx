import Link from "next/link";
import { HomeIcon, ListIcon, MapIcon } from "./icons";

/**
 * 담당자 하단 탭 (Figma ① 8:1945).
 *
 * 오늘·지도·기록은 모두 활성. `date`·`workerId`를 링크에 실어
 * 탭 왕복이 같은 날·담당자를 유지하게 한다.
 */
const ITEMS = [
  { key: "today", label: "오늘", href: "/today", Icon: HomeIcon },
  { key: "map", label: "지도", href: "/map", Icon: MapIcon },
  { key: "log", label: "기록", href: "/today/log", Icon: ListIcon },
] as const;

function withContext(path: string, date?: string, workerId?: string): string {
  const query = new URLSearchParams();
  if (date) query.set("date", date);
  if (workerId) query.set("workerId", workerId);
  const value = query.toString();
  return value ? `${path}?${value}` : path;
}

export function BottomNav({
  current,
  date,
  workerId,
}: {
  current: "today" | "map" | "log";
  date?: string;
  workerId?: string;
}) {
  return (
    <nav
      aria-label="담당자 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[79px] w-full max-w-[520px] border-t border-border-default bg-surface-default"
    >
      {ITEMS.map(({ key, label, href, Icon }) => {
        const active = key === current;
        const tone = active ? "text-action-primary" : "text-text-secondary";
        const body = (
          <>
            <Icon className="size-[26px]" />
            <span className="text-label-13">{label}</span>
          </>
        );

        return (
          <Link
            key={key}
            href={withContext(href, date, workerId)}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-[3px] ${tone}`}
          >
            {body}
          </Link>
        );
      })}
    </nav>
  );
}
