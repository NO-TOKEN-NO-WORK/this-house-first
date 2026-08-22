import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
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
  RiskGrade,
} from "../../lib/domain";
import { AdminMap } from "../../components/admin/AdminMap";
import { AdminControls } from "../../components/admin/AdminControls";
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

function subjectHref(subjectId: string, date?: string, workerId?: string | null) {
  const query = new URLSearchParams();
  if (date) query.set("date", date);
  if (workerId) query.set("workerId", workerId);
  const search = query.toString();
  return `/today/${subjectId}${search ? `?${search}` : ""}`;
}

export function PriorityList({
  subjects,
  date,
  workerId,
}: {
  subjects: AdminDashboardSubject[];
  date?: string;
  workerId?: string | null;
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
        <span className={styles.panelHeaderControls}>
          <label>
            <Image alt="" aria-hidden="true" height={14} src="/admin/search.png" width={14} />
            <input aria-label="대상자 검색" placeholder="대상자 검색" type="search" />
          </label>
          <select aria-label="대상자 상태" defaultValue="all">
            <option value="all">전체 상태</option>
          </select>
        </span>
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
                      <button disabled type="button">수정</button>
                      <button disabled type="button">삭제</button>
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
        <button className={styles.outlineAction} disabled type="button">
          <Image alt="" aria-hidden="true" height={16} src="/admin/add.png" width={16} />
          생활지원사 등록
        </button>
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
                  <td>{maskPhone(worker.phone ?? assigned[0]?.workerPhone)}</td>
                  <td>
                    <span className={subjectCount ? styles.workerActive : styles.workerIdle}>
                      {subjectCount ? "근무 중" : "휴식 중"}
                    </span>
                  </td>
                  <td>
                    <span className={styles.rowActions}>
                      <Link href={`/today?workerId=${worker.id}`}>상세</Link>
                      <button disabled type="button">수정</button>
                      <button disabled type="button">삭제</button>
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

function StatusLegend() {
  return (
    <section className={styles.statusFilters} aria-labelledby="status-filter-title">
      <h2 id="status-filter-title" className={styles.sidebarTitle}>상태</h2>
      <ul>
        {STATUS_LEGEND.map((entry) => (
          <li key={`${entry.category}-${entry.statuses.join("-")}`}>
            <input
              aria-label={`${entry.statuses.map((status) => HOUSEHOLD_STATUS_LABEL[status]).join(" · ")} 표시`}
              defaultChecked
              type="checkbox"
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
    </section>
  );
}

function SubjectDetailCard({
  subject,
  date,
  workerId,
}: {
  subject: AdminDashboardSubject;
  date: string;
  workerId: string | null;
}) {
  return (
    <section className={styles.subjectDetail} aria-labelledby="subject-detail-title">
      <header className={styles.detailHeader}>
        <h2 id="subject-detail-title" className={styles.sidebarTitle}>대상자 상세</h2>
        <button aria-label="대상자 상세 닫기" className={styles.detailClose} disabled type="button">
          <Image alt="" aria-hidden="true" height={16} src="/admin/close.png" width={16} />
        </button>
      </header>
      <div className={styles.detailIdentity}>
        <Image
          alt={`${subject.name} 합성 프로필`}
          className={styles.detailAvatar}
          height={64}
          src={avatarSrc(0)}
          width={64}
        />
        <div>
          <strong>{subject.name}</strong>
          <span className={styles.detailBadges}>
            <span className={`${styles.badge} ${GRADE_CLASS[subject.grade]}`}>
              {GRADE_LABEL[subject.grade]}
            </span>
            <span className={styles.statusBadge}>{subject.statusLabel}</span>
          </span>
          {subject.phone ? (
            <a href={`tel:${subject.phone}`}>
              <Image alt="" aria-hidden="true" height={12} src="/admin/phone.png" width={12} />
              {maskPhone(subject.phone)}
            </a>
          ) : null}
        </div>
      </div>
      <dl className={styles.detailFacts}>
        <div><dt>생년</dt><dd>{subject.birthYear}년</dd></div>
        <div><dt>주소</dt><dd>{subject.address}</dd></div>
        <div><dt>담당자</dt><dd>{subject.workerName}</dd></div>
      </dl>
      <ul className={styles.detailReasons} aria-label={`${subject.name} 위험 사유`}>
        {subject.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
      </ul>
      <div className={styles.detailActions}>
        <Link href={subjectHref(subject.subjectId, date, workerId)}>상세 보기</Link>
        <button disabled type="button">삭제</button>
      </div>
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

function FilterForm({ dashboard }: { dashboard: AdminDashboard }) {
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
          <input aria-label="담당자 검색" placeholder="담당자 검색" type="search" />
        </div>
        <label><input defaultChecked={!dashboard.selectedWorkerId} name="workerId" type="radio" value="" />전체 담당자</label>
        {dashboard.workers.map((worker) => (
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
      <button className={styles.outlineAction} disabled type="button">
        <Image alt="" aria-hidden="true" height={16} src="/admin/add.png" width={16} />
        대상자 등록
      </button>
      <button className={styles.outlineAction} disabled type="button">
        <Image alt="" aria-hidden="true" height={16} src="/admin/add.png" width={16} />
        생활지원사 등록
      </button>
    </div>
  );
}

export function AdminDashboardView({
  dashboard,
  mapKey,
  controls,
}: {
  dashboard: AdminDashboard;
  mapKey: string;
  controls?: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <TopBar dashboard={dashboard} controls={controls} />
      <RegistrationActions />
      <main className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="관제 필터와 대상자 상세">
          <FilterForm dashboard={dashboard} />
          <StatusLegend />
          {dashboard.alerted && dashboard.subjects[0] ? (
            <SubjectDetailCard
              date={dashboard.date}
              subject={dashboard.subjects[0]}
              workerId={dashboard.selectedWorkerId}
            />
          ) : null}
        </aside>
        <section className={styles.dashboardContent} aria-label="관리자 관제 현황">
          {dashboard.alerted ? (
            <>
              <SummaryCards summary={dashboard.summary} />
              <section className={styles.mapGrid} aria-label="지도와 건물별 현황">
                <AdminMap buildings={dashboard.buildings} mapKey={mapKey} />
                <BuildingStatusPanel buildings={dashboard.buildings} />
              </section>
              <section className={styles.managementGrid} aria-label="대상자와 생활지원사 관리">
                <PriorityList
                  date={dashboard.date}
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
}): { date?: string; workerId?: string } | null {
  if (Array.isArray(params.date) || Array.isArray(params.workerId)) return null;
  if (params.date !== undefined && !isIsoDate(params.date)) return null;
  return { date: params.date, workerId: params.workerId };
}

export default async function AdminPage(props: PageProps<"/admin">) {
  const params = await props.searchParams;
  const query = normalizeAdminSearchParams(params);
  if (!query) notFound();
  const { date, workerId } = query;
  const dashboard = await getAdminDashboard({ date, workerId });

  return (
    <AdminDashboardView
      controls={<AdminControls date={dashboard.date} />}
      dashboard={dashboard}
      mapKey={process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim() ?? ""}
    />
  );
}
