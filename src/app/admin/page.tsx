import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  getAdminDashboard,
  type AdminAlertedDashboard,
  type AdminDashboard,
  type AdminDashboardSubject,
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

const LAST_UPDATED_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
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
    },
    { label: "전체 미처리", value: summary.open },
    {
      label: HOUSEHOLD_STATUS_LABEL[HouseholdStatus.VISIT_QUEUED],
      value: summary.visitQueued,
    },
    { label: "오늘 처리 완료", value: summary.completed },
  ];

  return (
    <section aria-label="오늘의 관제 요약" className={styles.summaryGrid}>
      {metrics.map((metric) => (
        <dl key={metric.label} className={styles.metric}>
          <dt className={styles.metricLabel}>{metric.label}</dt>
          <dd className={styles.metricValue}>{metric.value}명</dd>
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
      <h2 id="priority-title" className={styles.sectionTitle}>
        위험도 우선 대상자
      </h2>
      {subjects.length === 0 ? (
        <p className={styles.emptyState}>선택한 담당자의 대상자가 없습니다.</p>
      ) : (
        <ol className={styles.priorityList}>
          {subjects.map((subject) => (
            <li key={subject.subjectId} className={styles.priorityItem}>
              <article className={styles.subjectArticle}>
                <div className={styles.subjectTopline}>
                  <span
                    className={`${styles.gradeBadge} ${GRADE_CLASS[subject.grade]}`}
                  >
                    {GRADE_LABEL[subject.grade]}
                  </span>
                  <span className={styles.statusBadge}>{subject.statusLabel}</span>
                </div>
                <Link
                  href={subjectHref(subject.subjectId, date, workerId)}
                  className={styles.subjectLink}
                >
                  <span>{subject.name}</span>
                  <span className={styles.detailHint}>상세 보기</span>
                </Link>
                <p className={styles.subjectMeta}>
                  담당자 · {subject.workerName} · {subject.address}
                </p>
                <p className={styles.reasonsTitle}>위험 사유</p>
                <ul className={styles.reasonList} aria-label={`${subject.name} 위험 사유`}>
                  {subject.reasons.map((reason, index) => (
                    <li key={`${subject.subjectId}-${index}`}>{reason}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function FilterForm({ dashboard }: { dashboard: AdminDashboard }) {
  return (
    <form action="/admin" method="get" className={styles.filterForm}>
      <fieldset className={styles.filterFieldset}>
        <legend className={styles.filterLegend}>관제 범위</legend>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>날짜</span>
          <input
            className={styles.filterControl}
            defaultValue={dashboard.date}
            name="date"
            type="date"
          />
        </label>
      </fieldset>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>담당자</span>
        <select
          className={styles.filterControl}
          defaultValue={dashboard.selectedWorkerId ?? ""}
          name="workerId"
        >
          <option value="">전체 담당자</option>
          {dashboard.workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.name}
            </option>
          ))}
        </select>
      </label>
      <button className={styles.submitButton} type="submit">
        적용
      </button>
    </form>
  );
}

function SituationHeader({ dashboard }: { dashboard: AdminDashboard }) {
  return (
    <header className={styles.situation}>
      <p className={styles.eyebrow}>오늘의 관제 현황</p>
      <h1 className={styles.title}>관리자 관제</h1>
      <div className={styles.situationRow}>
        <span className={styles.dateLabel}>{dashboard.dateLabel}</span>
        {dashboard.alerted ? (
          <>
            <div className={styles.alertReadout}>
              <span className={styles.eyebrow}>경보 단계</span>
              <p className={styles.alertLevel}>{dashboard.levelLabel}</p>
            </div>
            <p className={styles.temperature}>최고 체감 {dashboard.feelsLikeMax}℃</p>
          </>
        ) : null}
      </div>
      <p className={styles.refreshStatus}>
        마지막 갱신 시각 ·{" "}
        <time dateTime={dashboard.generatedAt}>
          {LAST_UPDATED_FORMAT.format(new Date(dashboard.generatedAt))}
        </time>{" "}
        · 10초마다 자동 갱신
      </p>
    </header>
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
      <nav className={styles.nav} aria-label="관리자 탐색">
        <Link href="/" className={styles.brand}>
          이 집 먼저
        </Link>
        <div className={styles.navMeta}>
          <Link href="/today" className={styles.navLink}>
            오늘의 대응 보드
          </Link>
          <span className={styles.adminLabel}>관리자</span>
        </div>
      </nav>
      <main className={styles.main}>
        <SituationHeader dashboard={dashboard} />
        <FilterForm dashboard={dashboard} />
        {dashboard.alerted ? (
          <>
            <SummaryCards summary={dashboard.summary} />
            <section className={styles.dashboardGrid} aria-label="관제 지도와 대상자 목록">
              <AdminMap buildings={dashboard.buildings} mapKey={mapKey} />
              <PriorityList
                subjects={dashboard.subjects}
                date={dashboard.date}
                workerId={dashboard.selectedWorkerId}
              />
            </section>
          </>
        ) : (
          <p className={styles.silentState}>
            오늘은 경보가 없습니다. 경보가 내려지면 위험도와 우선 확인 대상을 안내합니다.
          </p>
        )}
        {controls}
      </main>
      <footer className={styles.footer}>© 2026 이 집 먼저 · 관리자 관제</footer>
    </div>
  );
}

export default async function AdminPage(props: PageProps<"/admin">) {
  const params = await props.searchParams;
  const date = typeof params.date === "string" ? params.date : undefined;
  if (date !== undefined && !isIsoDate(date)) notFound();
  const workerId =
    typeof params.workerId === "string" ? params.workerId : undefined;
  const dashboard = await getAdminDashboard({ date, workerId });

  return (
    <AdminDashboardView
      dashboard={dashboard}
      mapKey={process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim() ?? ""}
      controls={<AdminControls date={dashboard.date} />}
    />
  );
}
