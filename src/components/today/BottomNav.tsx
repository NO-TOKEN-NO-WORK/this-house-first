import Link from "next/link";
import { HomeIcon, ListIcon, MapIcon } from "./icons";

/**
 * 담당자 하단 탭 (Figma ① 8:1945).
 *
 * 지도(④ 관제 지도)·기록은 아직 화면이 없다. 눌러도 아무 일이 없는 링크를 두면 담당자가
 * 고장으로 읽으므로, 준비 중임을 드러낸 비활성 항목으로 둔다.
 */
const ITEMS = [
  { key: "today", label: "오늘", href: "/today", Icon: HomeIcon },
  { key: "map", label: "지도", href: null, Icon: MapIcon },
  { key: "log", label: "기록", href: null, Icon: ListIcon },
] as const;

export function BottomNav({ current }: { current: "today" | "map" | "log" }) {
  return (
    <nav
      aria-label="담당자 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[79px] w-full max-w-[520px] border-t border-line bg-white"
    >
      {ITEMS.map(({ key, label, href, Icon }) => {
        const active = key === current;
        const tone = active ? "text-brand" : "text-ink-soft";
        const body = (
          <>
            <Icon className="size-[26px]" />
            <span className="text-[13px] font-bold">{label}</span>
          </>
        );

        return href ? (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-[3px] ${tone}`}
          >
            {body}
          </Link>
        ) : (
          <span
            key={key}
            aria-disabled="true"
            title="준비 중"
            className="flex flex-1 flex-col items-center justify-center gap-[3px] text-calm"
          >
            {body}
          </span>
        );
      })}
    </nav>
  );
}
