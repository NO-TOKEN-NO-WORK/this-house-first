import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PushNotificationManager } from "../../components/PushNotificationManager";
import {
  getAdminDashboard,
  type AdminAlertedDashboard,
  type AdminDashboard,
  type AdminDashboardBuilding,
  type AdminDashboardSubject,
  type AdminStatusCategory,
} from "../../lib/admin/dashboard";
import { isIsoDate } from "../../lib/board/format";
import {
  GRADE_LABEL,
  HouseholdStatus,
  HOUSEHOLD_STATUS_LABEL,
  isHouseholdStatus,
  RiskGrade,
} from "../../lib/domain";
import { AdminMap } from "../../components/admin/AdminMap";
import { AdminControls } from "../../components/admin/AdminControls";
import {
  getManagerNotificationFeed,
  type ManagerNotificationFeed,
} from "../../lib/notifications/read";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

const GRADE_CLASS: Record<RiskGrade, string> = {
  [RiskGrade.CRITICAL]: styles.grade1,
  [RiskGrade.HIGH]: styles.grade2,
  [RiskGrade.MODERATE]: styles.grade3,
};

const STATUS_LEGEND: Array<{
  category: AdminStatusCategory;
  icon: string;
  statuses: HouseholdStatus[];
}> = [
  {
    category: "unchecked",
    icon: "/admin/status-unchecked.png",
    statuses: [HouseholdStatus.UNCHECKED],
  },
  {
    category: "called",
    icon: "/admin/status-called.png",
    statuses: [HouseholdStatus.CALL_OK],
  },
  {
    category: "unchecked",
    icon: "/admin/status-no-answer.png",
    statuses: [HouseholdStatus.NO_ANSWER_1],
  },
  {
    category: "visit",
    icon: "/admin/status-visit.png",
    statuses: [HouseholdStatus.VISIT_QUEUED],
  },
  {
    category: "visit",
    icon: "/admin/status-called.png",
    statuses: [HouseholdStatus.VISITING],
  },
  {
    category: "resolved",
    icon: "/admin/status-resolved.png",
    statuses: [HouseholdStatus.RESOLVED],
  },
  {
    category: "emergency",
    icon: "/admin/status-emergency.png",
    statuses: [HouseholdStatus.EMERGENCY_119],
  },
  {
    category: "unreachable",
    icon: "/admin/status-unreachable.png",
    statuses: [HouseholdStatus.UNREACHABLE],
  },
];

const SUBJECT_AVATARS = [
  "/admin/elder-female-1.png",
  "/admin/elder-male-1.png",
  "/admin/elder-female-2.png",
  "/admin/elder-male-2.png",
  "/admin/elder-female-3.png",
] as const;

const LAST_UPDATED_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Seoul",
});

function avatarSrc(index: number): string {
  return SUBJECT_AVATARS[index % SUBJECT_AVATARS.length];
}

function compactRegion(dashboard: AdminDashboard): string {
  const address = dashboard.subjects[0]?.address;
  return address ? address.split(" ").slice(0, 2).join(" ") : "전체 담당 지역";
}

function compactAddress(address: string): string {
  return address.split(" ").slice(-2).join(" ");
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "연락처 미등록";
  const parts = phone.split("-");
  return parts.length === 3 ? `${parts[0]}-****-${parts[2]}` : phone;
}

function buildingIconSrc(grade: RiskGrade): string {
  if (grade === RiskGrade.CRITICAL) return "/admin/building-critical.png";
  if (grade === RiskGrade.HIGH) return "/admin/building-high.png";
  return "/admin/building-moderate.png";
}

const NOTIFICATION_TIME_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Seoul",
});

export function SummaryCards({
  summary,
}: {
  summary: AdminAlertedDashboard["summary"];
}) {
  const metrics = [
    {
      label: `${HOUSEHOLD_STATUS_LABEL[HouseholdStatus.UNCHECKED]} ${GRADE_LABEL[RiskGrade.CRITICAL]}`,
      value: summary.openCritical,
      icon: "/admin/metric-critical.png",
      tone: styles.metricCritical,
    },
    {
      label: "전체 미처리",
      value: summary.open,
      icon: "/admin/metric-open.png",
      tone: styles.metricOpen,
    },
    {
      label: HOUSEHOLD_STATUS_LABEL[HouseholdStatus.VISIT_QUEUED],
      value: summary.visitQueued,
      icon: "/admin/metric-visit.png",
      tone: styles.metricVisit,
    },
    {
      label: "오늘 처리 완료",
      value: summary.completed,
      icon: "/admin/metric-completed.png",
      tone: styles.metricCompleted,
    },
  ];

  return (
    <section aria-label="오늘의 관제 요약" className={styles.summaryGrid}>
      {metrics.map((metric) => (
        <dl key={metric.label} className={`${styles.metric} ${metric.tone}`}>
          <Image
            alt=""
            aria-hidden="true"
            className={styles.metricIcon}
            height={56}
            src={metric.icon}
            width={56}
          />
          <div className={styles.metricCopy}>
            <dt className={styles.metricLabel}>{metric.label}</dt>
            <dd className={styles.metricValue}>
              {metric.value}<span>명</span>
            </dd>
          </div>
        </dl>
      ))}
    </section>
  );
}

export function NotificationFeed({
  feed,
}: {
  feed: ManagerNotificationFeed;
}) {
  return (
    <section className={styles.notificationPanel} aria-labelledby="notification-title">
      <header className={styles.panelHeader}>
        <span className={styles.panelTitleGroup}>
          <h2 id="notification-title" className={styles.panelTitle}>
            방문 승격 알림
          </h2>
          <span className={styles.panelHint}>실시간 대응</span>
        </span>
        <span className={styles.notificationCount}>{feed.items.length}건</span>
      </header>
      {feed.items.length === 0 ? (
        <p className={styles.emptyState}>새로 승격된 방문 대상이 없습니다.</p>
      ) : (
        <ol className={styles.notificationList}>
          {feed.items.map((item) => (
            <li key={item.id} className={styles.notificationItem}>
              <Link href={item.href} className={styles.notificationLink}>
                <span className={styles.notificationBody}>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </span>
                <time dateTime={item.availableAt} className={styles.notificationTime}>
                  {NOTIFICATION_TIME_FORMAT.format(new Date(item.availableAt))}
                </time>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function subjectHref(subjectId: string, date?: string, workerId?: string | null) {
  const query = new URLSearchParams();
  if (date) query.set("date", date);
  if (workerId) query.set("workerId", workerId);
  const search = query.toString();
  return `/admin/subjects/${subjectId}${search ? `?${search}` : ""}`;
}

export function PriorityList({
  subjects,
  date,
  workerId,
  subjectQuery = "",
  selectedStatus,
}: {
  subjects: AdminDashboardSubject[];
  date?: string;
  workerId?: string | null;
  subjectQuery?: string;
  selectedStatus?: HouseholdStatus;
}) {
  return (
    <section className={styles.priorityPanel} aria-labelledby="priority-title">
      <header className={styles.panelHeader}>
        <span className={styles.panelTitleGroup}>
          <h2 id="priority-title" className={styles.panelTitle}>
            위험도 우선 대상자
          </h2>
          <span className={styles.panelHint}>대상자 관리</span>
        </span>
        <form action="/admin" className={styles.panelHeaderControls} method="get">
          {date ? <input name="date" type="hidden" value={date} /> : null}
          {workerId ? <input name="workerId" type="hidden" value={workerId} /> : null}
          <label>
            <Image alt="" aria-hidden="true" height={14} src="/admin/search.png" width={14} />
            <input
              aria-label="대상자 검색"
              defaultValue={subjectQuery}
              name="subjectQuery"
              placeholder="대상자 검색"
              type="search"
            />
          </label>
          <select aria-label="대상자 상태" defaultValue={selectedStatus ?? "all"} name="status">
            <option value="all">전체 상태</option>
            {Object.values(HouseholdStatus).map((status) => (
              <option key={status} value={status}>{HOUSEHOLD_STATUS_LABEL[status]}</option>
            ))}
          </select>
          <button className={styles.compactSubmit} type="submit">검색</button>
        </form>
      </header>
      {subjects.length === 0 ? (
        <p className={styles.emptyState}>선택한 담당자의 대상자가 없습니다.</p>
      ) : (
        <div className={styles.tableScroller}>
          <table className={styles.priorityTable}>
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col">대상자 이름</th>
                <th scope="col">등급</th>
                <th scope="col">상태</th>
                <th scope="col">담당자</th>
                <th scope="col">주소</th>
                <th scope="col">위험 사유</th>
                <th scope="col">관리</th>
              </tr>
            </thead>
            <tbody>
              {subjects.slice(0, 6).map((subject, index) => (
                <tr key={subject.subjectId} className={subject.open ? styles.openRow : ""}>
                  <td><span className={styles.rankBadge}>{index + 1}</span></td>
                  <td>
                    <span className={styles.personCell}>
                      <Image
                        alt=""
                        aria-hidden="true"
                        className={styles.tableAvatar}
                        height={30}
                        src={avatarSrc(index)}
                        width={30}
                      />
                      <strong>{subject.name}</strong>
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${GRADE_CLASS[subject.grade]}`}>
                      {GRADE_LABEL[subject.grade]}
                    </span>
                  </td>
                  <td><span className={styles.statusBadge}>{subject.statusLabel}</span></td>
                  <td>
                    <span className={styles.inlineIconText}>
                      <Image alt="" aria-hidden="true" height={14} src="/admin/person.png" width={14} />
                      {subject.workerName}
                    </span>
                  </td>
                  <td className={styles.addressCell}>{compactAddress(subject.address)}</td>
                  <td className={styles.reasonCell}>{subject.reasons.join(" / ")}</td>
                  <td>
                    <span className={styles.rowActions}>
                      <Link href={subjectHref(subject.subjectId, date, workerId)}>상세</Link>
                      <Link href={`/admin/subjects/${subject.subjectId}/edit`}>수정</Link>
                      <Link className={styles.dangerLink} href={`${subjectHref(subject.subjectId, date, workerId)}#delete`}>삭제</Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BuildingStatusPanel({ buildings }: { buildings: AdminDashboardBuilding[] }) {
  const totalOpen = buildings.reduce((total, building) => total + building.openCount, 0);

  return (
    <section className={styles.buildingPanel} aria-labelledby="building-status-title">
      <h2 id="building-status-title" className={styles.panelTitle}>건물별 미처리 현황</h2>
      <ul className={styles.buildingList}>
        {buildings.slice(0, 5).map((building) => (
          <li key={building.buildingId} className={styles.buildingRow}>
            <Image
              alt=""
              aria-hidden="true"
              className={styles.buildingIcon}
              height={20}
              src={buildingIconSrc(building.grade)}
              width={20}
            />
            <span className={styles.buildingName}>{compactAddress(building.address)}</span>
            <span className={`${styles.badge} ${GRADE_CLASS[building.grade]}`}>
              {building.grade === RiskGrade.CRITICAL
                ? `${GRADE_LABEL[RiskGrade.CRITICAL]} 포함`
                : GRADE_LABEL[building.grade]}
            </span>
            <span>{building.openCount > 0 ? "미처리" : "처리 완료"}</span>
            <strong>{building.openCount}명</strong>
          </li>
        ))}
      </ul>
      <p className={styles.buildingTotal}>
        <span>전체 미처리 인원</span><strong>{totalOpen}명</strong>
      </p>
    </section>
  );
}

function WorkerPanel({ dashboard }: { dashboard: AdminAlertedDashboard }) {
  return (
    <section className={styles.workerPanel} aria-labelledby="worker-title">
      <header className={styles.panelHeader}>
        <h2 id="worker-title" className={styles.panelTitle}>생활지원사 관리</h2>
        <Link className={styles.outlineAction} href="/admin/workers/new">
          <Image alt="" aria-hidden="true" height={16} src="/admin/add.png" width={16} />
          생활지원사 등록
        </Link>
      </header>
      <div className={styles.tableScroller}>
        <table className={styles.workerTable}>
          <thead>
            <tr>
              <th scope="col">이름</th>
              <th scope="col">담당 대상자 수</th>
              <th scope="col">연락처</th>
              <th scope="col">상태</th>
              <th scope="col">관리</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.workers.map((worker) => {
              const assigned = dashboard.subjects.filter(
                (subject) => subject.workerId === worker.id,
              );
              const subjectCount = worker.subjectCount ?? assigned.length;
              return (
                <tr key={worker.id}>
                  <td><strong>{worker.name}</strong></td>
                  <td>{subjectCount}명</td>
                  <td>
                    <span className={styles.inlineIconText}>
                      <Image alt="" aria-hidden="true" height={14} src="/admin/phone.png" width={14} />
                      {maskPhone(worker.phone ?? assigned[0]?.workerPhone)}
                    </span>
                  </td>
                  <td>
                    <span className={subjectCount ? styles.workerActive : styles.workerIdle}>
                      {subjectCount ? "근무 중" : "휴식 중"}
                    </span>
                  </td>
                  <td>
                    <span className={styles.rowActions}>
                      <Link href={`/today?workerId=${worker.id}`}>상세</Link>
                      <Link href={`/admin/workers/${worker.id}/edit`}>수정</Link>
                      <Link className={styles.dangerLink} href={`/admin/workers/${worker.id}/edit#delete`}>삭제</Link>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusLegend({
  date,
  workerId,
  subjectQuery,
  selectedStatuses,
}: {
  date: string;
  workerId: string | null;
  subjectQuery?: string;
  selectedStatuses?: readonly HouseholdStatus[];
}) {
  return (
    <section className={styles.statusFilters} aria-labelledby="status-filter-title">
      <h2 id="status-filter-title" className={styles.sidebarTitle}>상태</h2>
      <form action="/admin" method="get">
        <input name="date" type="hidden" value={date} />
        {workerId ? <input name="workerId" type="hidden" value={workerId} /> : null}
        {subjectQuery ? <input name="subjectQuery" type="hidden" value={subjectQuery} /> : null}
        <input name="status" type="hidden" value="__none" />
        <ul>
          {STATUS_LEGEND.map((entry) => (
            <li key={`${entry.category}-${entry.statuses.join("-")}`}>
              <input
                aria-label={`${entry.statuses.map((status) => HOUSEHOLD_STATUS_LABEL[status]).join(" · ")} 표시`}
                defaultChecked={
                  selectedStatuses === undefined ||
                  entry.statuses.some((status) => selectedStatuses.includes(status))
                }
                name="status"
                type="checkbox"
                value={entry.statuses[0]}
              />
              <Image
                alt=""
                aria-hidden="true"
                className={styles.statusIcon}
                height={20}
                src={entry.icon}
                width={20}
              />
              {entry.statuses.map((status) => HOUSEHOLD_STATUS_LABEL[status]).join(" · ")}
            </li>
          ))}
        </ul>
        <button className={styles.statusSubmit} type="submit">상태 적용</button>
      </form>
    </section>
  );
}

function DataSources() {
  return (
    <section className={styles.screenReaderOnly} aria-labelledby="data-sources-title">
      <h2 id="data-sources-title">데이터 출처</h2>
      <p>
        경보 단계·체감온도: 기상청 단기예보·특보 API · 건물 정보: 국토부 건축HUB 건축물대장 · 지도: 카카오맵 API
      </p>
    </section>
  );
}

function FilterForm({
  dashboard,
  workerQuery = "",
}: {
  dashboard: AdminDashboard;
  workerQuery?: string;
}) {
  const visibleWorkers = dashboard.workers.filter((worker) =>
    worker.name.includes(workerQuery.trim()),
  );
  return (
    <form action="/admin" method="get" className={styles.filterForm}>
      <label className={styles.filterField}>
        <span className={styles.sidebarTitle}>날짜</span>
        <span className={styles.dateControl}>
          <Image alt="" aria-hidden="true" height={16} src="/admin/calendar.png" width={16} />
          <input className={styles.filterControl} defaultValue={dashboard.date} name="date" type="date" />
        </span>
      </label>
      <fieldset className={styles.workerFilters}>
        <legend className={styles.sidebarTitle}>담당자</legend>
        <div className={styles.workerSearch}>
          <button aria-label="필터 적용" className={styles.workerSearchButton} type="submit">
            <Image alt="" aria-hidden="true" height={16} src="/admin/search.png" width={16} />
          </button>
          <input
            aria-label="담당자 검색"
            defaultValue={workerQuery}
            name="workerQuery"
            placeholder="담당자 검색"
            type="search"
          />
        </div>
        <label><input defaultChecked={!dashboard.selectedWorkerId} name="workerId" type="radio" value="" />전체 담당자</label>
        {visibleWorkers.map((worker) => (
          <label key={worker.id}>
            <input
              defaultChecked={dashboard.selectedWorkerId === worker.id}
              name="workerId"
              type="radio"
              value={worker.id}
            />
            {worker.name}
          </label>
        ))}
      </fieldset>
    </form>
  );
}

function TopBar({
  dashboard,
  controls,
}: {
  dashboard: AdminDashboard;
  controls?: ReactNode;
}) {
  return (
    <header className={styles.topBar}>
      <Link href="/" className={styles.brand}>
        <Image alt="" aria-hidden="true" height={32} src="/admin/brand-mark.png" width={32} />
        <span>이 집 먼저</span>
      </Link>
      <h1 className={styles.title}>관리자 관제</h1>
      <div className={styles.topMeta}>
        <dl className={styles.metaItem}>
          <Image alt="" aria-hidden="true" className={styles.metaIcon} height={20} src="/admin/calendar.png" width={20} />
          <dt>날짜</dt><dd>{dashboard.date.replaceAll("-", ".")}</dd>
        </dl>
        <dl className={styles.metaItem}>
          <Image alt="" aria-hidden="true" className={styles.metaIcon} height={20} src="/admin/location.png" width={20} />
          <dt>담당 지역</dt><dd>{compactRegion(dashboard)}</dd>
        </dl>
        {dashboard.alerted ? (
          <dl className={`${styles.metaItem} ${styles.temperature}`}>
            <Image alt="" aria-hidden="true" className={styles.metaIcon} height={20} src="/admin/thermometer.png" width={20} />
            <dt>최고 체감온도</dt><dd>{dashboard.feelsLikeMax}°C</dd>
          </dl>
        ) : null}
        <dl className={styles.metaItem}>
          <Image alt="" aria-hidden="true" className={styles.metaIcon} height={20} src="/admin/clock.png" width={20} />
          <dt>마지막 갱신</dt>
          <dd><time dateTime={dashboard.generatedAt}>{LAST_UPDATED_FORMAT.format(new Date(dashboard.generatedAt))}</time></dd>
        </dl>
        <dl className={styles.metaItem}>
          <Image alt="" aria-hidden="true" className={styles.metaIcon} height={20} src="/admin/refresh.png" width={20} />
          <dt>자동 갱신</dt><dd>켜짐 <Image alt="작동 중" className={styles.liveDot} height={8} src="/admin/status-resolved.png" width={8} /></dd>
        </dl>
      </div>
      {controls}
    </header>
  );
}

function RegistrationActions() {
  return (
    <div className={styles.registrationActions} aria-label="관리 등록 기능">
      <Link className={styles.outlineAction} href="/admin/subjects/new">
        <Image alt="" aria-hidden="true" height={16} src="/admin/add.png" width={16} />
        대상자 등록
      </Link>
      <Link className={styles.outlineAction} href="/admin/workers/new">
        <Image alt="" aria-hidden="true" height={16} src="/admin/add.png" width={16} />
        생활지원사 등록
      </Link>
    </div>
  );
}

interface AdminViewFilters {
  subjectQuery?: string;
  workerQuery?: string;
  selectedStatuses?: readonly HouseholdStatus[];
}

export function AdminDashboardView({
  dashboard,
  mapKey,
  controls,
  filters = {},
  notificationFeed,
  pushPublicKey = "",
}: {
  dashboard: AdminDashboard;
  mapKey: string;
  controls?: ReactNode;
  filters?: AdminViewFilters;
  notificationFeed?: ManagerNotificationFeed;
  pushPublicKey?: string;
}) {
  return (
    <div className={styles.page}>
      <TopBar dashboard={dashboard} controls={controls} />
      <RegistrationActions />
      <main className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="관제 필터와 대상자 상세">
          <FilterForm dashboard={dashboard} workerQuery={filters.workerQuery} />
          <StatusLegend
            date={dashboard.date}
            selectedStatuses={filters.selectedStatuses}
            subjectQuery={filters.subjectQuery}
            workerId={dashboard.selectedWorkerId}
          />
        </aside>
        <section className={styles.dashboardContent} aria-label="관리자 관제 현황">
          {dashboard.alerted && notificationFeed ? (
            <div className={styles.notificationArea}>
              {notificationFeed?.recipientId ? (
                <PushNotificationManager
                  workerId={notificationFeed.recipientId}
                  publicKey={pushPublicKey}
                />
              ) : null}
              <NotificationFeed feed={notificationFeed} />
            </div>
          ) : null}
          {dashboard.alerted ? (
            <>
              <SummaryCards summary={dashboard.summary} />
              <section className={styles.mapGrid} aria-label="지도와 건물별 현황">
                <AdminMap buildings={dashboard.buildings} date={dashboard.date} mapKey={mapKey} />
                <BuildingStatusPanel buildings={dashboard.buildings} />
              </section>
              <section className={styles.managementGrid} aria-label="대상자와 생활지원사 관리">
                <PriorityList
                  date={dashboard.date}
                  selectedStatus={
                    filters.selectedStatuses?.length === 1
                      ? filters.selectedStatuses[0]
                      : undefined
                  }
                  subjectQuery={filters.subjectQuery}
                  subjects={dashboard.subjects}
                  workerId={dashboard.selectedWorkerId}
                />
                <WorkerPanel dashboard={dashboard} />
              </section>
            </>
          ) : (
            <p className={styles.silentState}>
              오늘은 경보가 없습니다. 경보가 내려지면 위험도와 우선 확인 대상을 안내합니다.
            </p>
          )}
          <DataSources />
        </section>
      </main>
    </div>
  );
}

export function normalizeAdminSearchParams(params: {
  date?: string | string[];
  workerId?: string | string[];
  subjectQuery?: string | string[];
  workerQuery?: string | string[];
  status?: string | string[];
}): {
  date?: string;
  workerId?: string;
  subjectQuery?: string;
  workerQuery?: string;
  selectedStatuses?: HouseholdStatus[];
} | null {
  if (
    Array.isArray(params.date) ||
    Array.isArray(params.workerId) ||
    Array.isArray(params.subjectQuery) ||
    Array.isArray(params.workerQuery)
  ) return null;
  if (params.date !== undefined && !isIsoDate(params.date)) return null;
  const rawStatuses = params.status === undefined
    ? undefined
    : Array.isArray(params.status)
      ? params.status
      : [params.status];
  const statusValues = rawStatuses?.filter((status) => status !== "__none" && status !== "all");
  if (statusValues?.some((status) => !isHouseholdStatus(status))) return null;
  return {
    date: params.date,
    workerId: params.workerId,
    subjectQuery: params.subjectQuery?.slice(0, 50),
    workerQuery: params.workerQuery?.slice(0, 50),
    selectedStatuses:
      rawStatuses === undefined || rawStatuses.includes("all")
        ? undefined
        : statusValues as HouseholdStatus[],
  };
}

export default async function AdminPage(props: PageProps<"/admin">) {
  const params = await props.searchParams;
  const query = normalizeAdminSearchParams(params);
  if (!query) notFound();
  const { date, workerId, subjectQuery, workerQuery, selectedStatuses } = query;
  const [dashboard, notificationFeed] = await Promise.all([
    getAdminDashboard({ date, workerId, subjectQuery, selectedStatuses }),
    getManagerNotificationFeed({ date, workerId }),
  ]);

  return (
    <AdminDashboardView
      controls={<AdminControls date={dashboard.date} />}
      dashboard={dashboard}
      filters={{ subjectQuery, workerQuery, selectedStatuses }}
      mapKey={process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim() ?? ""}
      notificationFeed={notificationFeed}
      pushPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? ""}
    />
  );
}
