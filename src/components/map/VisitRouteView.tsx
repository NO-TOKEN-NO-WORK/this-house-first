import { GRADE_CHIP } from "@/components/today/gradeStyles";
import { GRADE_LABEL, RiskGrade } from "@/lib/domain";
import {
  kakaoDirectionsHref,
  type VisitRoute,
  type VisitRouteStop,
} from "@/lib/map/route";

interface RoutePoint {
  x: number;
  y: number;
}

const ROUTE_POINTS: readonly RoutePoint[] = [
  { x: 16, y: 33 },
  { x: 48, y: 15 },
  { x: 83, y: 30 },
  { x: 78, y: 62 },
  { x: 45, y: 48 },
  { x: 16, y: 68 },
  { x: 28, y: 86 },
  { x: 58, y: 72 },
  { x: 86, y: 87 },
] as const;

const ROUTE_MAP_WIDTH = 360;
const ROUTE_MAP_HEIGHT = 294;

/** Figma 25:495의 작은 위험 칩은 카드 순번의 채움 칩과 다른 subtle 변형이다. */
const ROUTE_GRADE_CHIP: Record<RiskGrade, string> = {
  [RiskGrade.CRITICAL]:
    "bg-status-critical-subtle text-status-critical-strong",
  [RiskGrade.HIGH]: "bg-status-warning-subtle text-status-warning-strong",
  [RiskGrade.MODERATE]: "bg-background-subtle text-text-supporting",
};

function routePoint(index: number): RoutePoint {
  return ROUTE_POINTS[index] ?? {
    x: 16 + ((index * 31) % 68),
    y: 18 + ((index * 23) % 68),
  };
}

function RouteSegment({
  from,
  to,
  minutes,
}: {
  from: RoutePoint;
  to: RoutePoint;
  minutes: number;
}) {
  const deltaX = ((to.x - from.x) / 100) * ROUTE_MAP_WIDTH;
  const deltaY = ((to.y - from.y) / 100) * ROUTE_MAP_HEIGHT;
  const length = Math.hypot(deltaX, deltaY);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  return (
    <>
      <span
        aria-hidden="true"
        className="absolute z-0 border-t-2 border-dashed border-border-strong"
        style={{
          left: `${from.x}%`,
          top: `${from.y}%`,
          width: `${length}px`,
          transform: `rotate(${angle}deg)`,
          transformOrigin: "left center",
        }}
      />
      <span
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 bg-surface-soft px-1 text-body-14 text-text-strong"
        style={{ left: `${(from.x + to.x) / 2}%`, top: `${(from.y + to.y) / 2}%` }}
      >
        {minutes}분
      </span>
    </>
  );
}

function RouteOverview({ route }: { route: VisitRoute }) {
  return (
    <section
      aria-label="방문 동선 요약"
      className="overflow-hidden rounded-[10px] border border-border-default bg-surface-default"
    >
      <div className="relative h-[294px] bg-surface-soft">
        {route.stops.slice(1).map((stop, index) => (
          <RouteSegment
            key={`${route.stops[index].subjectId}-${stop.subjectId}`}
            from={routePoint(index)}
            to={routePoint(index + 1)}
            minutes={stop.minutesFromPrevious}
          />
        ))}

        {route.stops.map((stop, index) => {
          const point = routePoint(index);
          const isLast = index === route.stops.length - 1;
          return (
            <span
              key={stop.subjectId}
              aria-label={`${index + 1}번째 방문 ${stop.name}`}
              className={`absolute z-20 flex size-[26px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-label-14 text-text-inverse shadow-sm ${
                isLast ? "bg-action-primary" : "bg-status-critical"
              }`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            >
              {index + 1}
            </span>
          );
        })}

        {route.stops.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-body-15-relaxed text-text-secondary">
            지금 방문할 가구가 없습니다.
          </p>
        ) : null}
      </div>

      <p className="flex min-h-12 items-center gap-2 border-t border-border-default px-3.5 text-label-15 text-text-primary">
        <span
          aria-hidden="true"
          className="size-[17px] shrink-0 bg-icon-secondary"
          style={{
            WebkitMaskImage: "url('/figma/visit-route-clock.svg')",
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "17px 17px",
            maskImage: "url('/figma/visit-route-clock.svg')",
            maskPosition: "center",
            maskRepeat: "no-repeat",
            maskSize: "17px 17px",
          }}
        />
        예상 이동 {route.totalMinutes}분 · 총 {route.stops.length}가구
      </p>
    </section>
  );
}

function VisitCard({ stop, order }: { stop: VisitRouteStop; order: number }) {
  return (
    <li className="flex flex-col gap-2 rounded-[10px] border border-border-default bg-surface-default px-[18px] py-5">
      <div className="flex min-w-0 items-center gap-[9px]">
        <span
          aria-hidden="true"
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-label-14 ${GRADE_CHIP[stop.grade]}`}
        >
          {order}
        </span>
        <p className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 text-heading-18 text-text-primary">{stop.name}</span>
          <span className="truncate text-body-14 text-text-secondary">
            {stop.age}세{stop.livesAlone ? " · 독거" : ""}
          </span>
        </p>
        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-caption-12 ${ROUTE_GRADE_CHIP[stop.grade]}`}
        >
          {GRADE_LABEL[stop.grade]}
        </span>
      </div>

      <p className="truncate text-body-15-relaxed text-text-secondary">{stop.address}</p>

      <ul
        aria-label={`${stop.name} 위험 사유`}
        className="list-disc space-y-1 pl-5 text-body-14 text-text-secondary"
      >
        {stop.reasons.map((reason, index) => (
          <li key={`${stop.subjectId}-reason-${index}`}>{reason}</li>
        ))}
      </ul>

      <a
        href={kakaoDirectionsHref(stop)}
        target="_blank"
        rel="noreferrer"
        aria-label={`${stop.name}님 경로 안내`}
        className="flex min-h-12 w-full items-center justify-center rounded-md bg-action-secondary px-4 text-label-15 text-text-inverse active:bg-action-secondary-strong"
      >
        경로 안내
      </a>
    </li>
  );
}

/** 담당자 방문 동선 (Figma 25:460). */
export function VisitRouteView({ route }: { route: VisitRoute }) {
  return (
    <div className="flex flex-col gap-3">
      <RouteOverview route={route} />
      {route.stops.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {route.stops.map((stop, index) => (
            <VisitCard key={stop.subjectId} stop={stop} order={index + 1} />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
