import Link from "next/link";

/**
 * 담당자 하단 탭 (Figma ① 25:146).
 *
 * 탭은 `오늘`·`방문 동선` 둘이다. `date`·`workerId`를 링크에 실어
 * 탭 왕복이 같은 날·담당자를 유지하게 한다.
 *
 * `/today/log`(기록)는 화면은 남아 있으나 이 디자인에 탭이 없다 —
 * `current="log"`로 열면 어느 탭도 활성이 아니다(없는 탭을 켜 두지 않는다).
 */
const ITEMS = [
  {
    key: "today",
    label: "오늘",
    href: "/today",
    icon: "/figma/today-home.svg",
    maskSize: "26px 26px",
  },
  {
    key: "map",
    label: "방문 동선",
    href: "/map",
    icon: "/figma/visit-route-pin.svg",
    maskSize: "21.2334px 24.3256px",
  },
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
      /*
       * 띠 배경은 화면 맨 아래까지 내려가되(`bottom-0`), 탭 자체는 `--safe-bottom`만큼
       * 위로 올라온다 — 홈 인디케이터·제스처 바가 글자를 덮지 않게 한다.
       */
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[520px] border-t border-border-default bg-surface-default pb-[var(--safe-bottom)]"
    >
      <div className="flex h-[79px]">
        {ITEMS.map(({ key, label, href, icon, maskSize }) => {
          const active = key === current;
          /*
           * 비활성 탭 글자색은 Figma의 `action/disabled`(#c6cfda) 대신 `text-secondary`다.
           * 흰 배경에서 #c6cfda는 대비 1.55:1로 13px 글자가 읽히지 않는다
           * (60대 사용자 기준, PRD §9 — ADR-0014의 접근성 예외와 같은 이유).
           */
          const tone = active ? "text-action-primary" : "text-text-secondary";

          return (
            <Link
              key={key}
              href={withContext(href, date, workerId)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-[3px] ${tone}`}
            >
              <span
                aria-hidden="true"
                /*
                 * 상자는 30px인데 세로 여백을 2px씩 깎아 자리는 Figma의 26px 그대로 차지한다.
                 * 핀(21.2334×24.3256)은 26px 상자 안에서 위아래 여유가 0.84px뿐이라
                 * `mask-clip: border-box`가 기기에 따라 윗머리를 깎았다 — 여유를 2.84px로 늘린다.
                 * `maskSize`는 그대로라 그려지는 아이콘 크기·위치는 달라지지 않는다.
                 */
                className="-my-[2px] size-[30px] shrink-0"
                style={{
                  backgroundColor: "currentColor",
                  WebkitMaskImage: `url('${icon}')`,
                  WebkitMaskPosition: "center",
                  WebkitMaskRepeat: "no-repeat",
                  WebkitMaskSize: maskSize,
                  maskImage: `url('${icon}')`,
                  maskPosition: "center",
                  maskRepeat: "no-repeat",
                  maskSize,
                }}
              />
              <span className="text-label-13">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
