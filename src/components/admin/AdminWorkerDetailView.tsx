import Image from "next/image";
import Link from "next/link";
import type { AdminWorkerDetail } from "../../lib/admin/worker-detail";
import {
  GRADE_LABEL,
  HouseholdStatus,
  HOUSEHOLD_STATUS_LABEL,
  RiskGrade,
} from "../../lib/domain";
import { AdminManagementHeader } from "./AdminSubjectViews";
import styles from "./admin-subject.module.css";

const SUBJECT_AVATARS = [
  "/admin/elder-female-1.png",
  "/admin/elder-male-1.png",
  "/admin/elder-female-2.png",
  "/admin/elder-male-2.png",
  "/admin/elder-female-3.png",
] as const;

function maskedPhone(phone: string | null): string {
  if (!phone) return "미등록";
  const [first, , last] = phone.split("-");
  return first && last ? `${first}-****-${last}` : phone;
}

function compactAddress(address: string): string {
  return address.split(" ").slice(-2).join(" ");
}

function GradeBadge({ grade }: { grade: RiskGrade | null }) {
  return grade ? (
    <span className={`${styles.badge} ${styles[`grade${grade}`]}`}>
      {GRADE_LABEL[grade]}
    </span>
  ) : <span className={styles.badge}>평가 전</span>;
}

export function AdminWorkerDetailView({
  detail,
  selectedStatus,
  subjectQuery = "",
}: {
  detail: AdminWorkerDetail;
  selectedStatus?: HouseholdStatus;
  subjectQuery?: string;
}) {
  const query = subjectQuery.trim().toLocaleLowerCase("ko-KR");
  const subjects = detail.subjects.filter((subject) =>
    (!query || subject.name.toLocaleLowerCase("ko-KR").includes(query)) &&
    (!selectedStatus || subject.status === selectedStatus),
  );
  const alerts = [
    detail.summary.openCritical
      ? `담당 미확인 ${GRADE_LABEL[RiskGrade.CRITICAL]} ${detail.summary.openCritical}명`
      : null,
    detail.summary.visitQueued
      ? `${HOUSEHOLD_STATUS_LABEL[HouseholdStatus.VISIT_QUEUED]} ${detail.summary.visitQueued}명`
      : null,
    detail.summary.coolingNeeded
      ? `냉방기 점검 필요 ${detail.summary.coolingNeeded}가구`
      : null,
  ].filter(Boolean).join(" / ") || "집중 확인 대상 없음";
  const metrics = [
    ["담당 미확인 심각", detail.summary.openCritical, "명", "/admin/metric-critical.png", styles.workerMetricCritical],
    ["방문 대기", detail.summary.visitQueued, "명", "/admin/metric-visit.png", styles.workerMetricVisit],
    ["오늘 처리 완료", detail.summary.completed, "명", "/admin/metric-completed.png", styles.workerMetricComplete],
    ["냉방기 점검 필요", detail.summary.coolingNeeded, "가구", "/admin/refresh.png", styles.workerMetricCooling],
  ] as const;

  return (
    <div className={styles.page}>
      <AdminManagementHeader
        breadcrumbBelow
        detail={null}
        label="생활지원사 상세"
        meta={{
          date: detail.date,
          feelsLikeMax: detail.feelsLikeMax,
          region: detail.region,
        }}
        sectionLabel="생활지원사 관리"
      />
      <main className={`${styles.detailShell} ${styles.workerDetailShell}`}>
        <div className={styles.detailColumn}>
          <section className={`${styles.profileCard} ${styles.workerProfileCard}`}>
            <Image
              alt={`${detail.name} 합성 프로필`}
              className={styles.profileAvatar}
              height={160}
              preload
              src="/admin/worker-profile.png"
              width={160}
            />
            <div className={styles.profileCopy}>
              <div className={styles.identityLine}>
                <h1>{detail.name}</h1><strong>생활지원사</strong>
              </div>
              <dl className={`${styles.profileFacts} ${styles.workerProfileFacts}`}>
                <div><dt>연락처</dt><dd>{maskedPhone(detail.phone)}</dd></div>
                <div><dt>소속</dt><dd>{detail.organization}</dd></div>
                <div><dt>담당 지역</dt><dd>{detail.region}</dd></div>
                <div><dt>담당 대상자 수</dt><dd>{detail.subjects.length}명</dd></div>
              </dl>
              <div className={styles.riskStrip}>
                <Image alt="" aria-hidden="true" height={20} src="/admin/metric-critical.png" width={20} />
                <strong>집중 확인 필요</strong><span>{alerts}</span>
              </div>
            </div>
          </section>

          <div className={styles.workerInfoGrid}>
            <section className={styles.infoCard}>
              <h2>기본 정보</h2>
              <dl>
                <div><dt>이름</dt><dd>{detail.name}</dd></div>
                <div><dt>소속</dt><dd>{detail.organization}</dd></div>
                <div><dt>연락처</dt><dd>{maskedPhone(detail.phone)}</dd></div>
                <div><dt>비상 연락처</dt><dd>미등록</dd></div>
                <div><dt>메모</dt><dd>미등록</dd></div>
              </dl>
            </section>
            <section className={styles.infoCard}>
              <h2>업무 정보</h2>
              <dl>
                <div><dt>담당 지역</dt><dd>{detail.region}</dd></div>
                <div><dt>담당 대상자 수</dt><dd>{detail.subjects.length}명</dd></div>
                <div><dt>미확인 심각</dt><dd><span className={styles.criticalCount}>{detail.summary.openCritical}명</span></dd></div>
                <div><dt>방문 대기</dt><dd><span className={styles.visitCount}>{detail.summary.visitQueued}명</span></dd></div>
                <div><dt>오늘 처리 완료</dt><dd><span className={styles.completeCount}>{detail.summary.completed}명</span></dd></div>
                <div><dt>최근 상태 변경</dt><dd>{detail.lastStateChangedAt ?? "기록 없음"}</dd></div>
              </dl>
            </section>
          </div>

          <section className={styles.workerSubjectsCard}>
            <header className={styles.workerCardHeader}>
              <h2>담당 대상자 목록</h2>
              <form action={`/admin/workers/${detail.id}`} method="get">
                <input name="date" type="hidden" value={detail.date} />
                <label>
                  <Image alt="" aria-hidden="true" height={14} src="/admin/search.png" width={14} />
                  <input aria-label="대상자 검색" defaultValue={subjectQuery} name="subjectQuery" placeholder="대상자 검색" type="search" />
                </label>
                <select aria-label="대상자 상태" defaultValue={selectedStatus ?? "all"} name="status">
                  <option value="all">전체 상태</option>
                  {Object.values(HouseholdStatus).map((status) => (
                    <option key={status} value={status}>{HOUSEHOLD_STATUS_LABEL[status]}</option>
                  ))}
                </select>
                <button type="submit">검색</button>
              </form>
            </header>
            {subjects.length ? (
              <div className={styles.workerTableScroller}>
                <table className={styles.workerSubjectsTable}>
                  <thead><tr><th>대상자 이름</th><th>위험 단계</th><th>상태</th><th>주소</th><th>위험 사유</th><th>냉방기</th><th>관리</th></tr></thead>
                  <tbody>
                    {subjects.map((subject, index) => (
                      <tr key={subject.id}>
                        <td><span className={styles.subjectIdentity}><Image alt="" aria-hidden="true" height={30} src={SUBJECT_AVATARS[index % SUBJECT_AVATARS.length]} width={30} /><strong>{subject.name}</strong></span></td>
                        <td><GradeBadge grade={subject.grade} /></td>
                        <td><span className={styles.statusBadge}>{subject.statusLabel}</span></td>
                        <td>{compactAddress(subject.address)}</td>
                        <td className={styles.workerReason}>{subject.reasons.join(" / ") || "평가 전"}</td>
                        <td><span className={subject.hasAircon === false || subject.airconBroken ? styles.coolingIssue : styles.coolingNormal}>{subject.hasAircon === false || subject.airconBroken ? "점검 필요" : "정상"}</span></td>
                        <td><span className={styles.workerRowActions}><Link href={`/admin/subjects/${subject.id}?date=${detail.date}`}>대상자 상세</Link><Link href={`/admin/subjects/${subject.id}/edit`}>담당 변경</Link></span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className={styles.workerEmpty}>조건에 맞는 담당 대상자가 없습니다.</p>}
            <footer className={styles.workerTableFooter}>전체 {subjects.length}건</footer>
          </section>
        </div>

        <aside className={styles.detailRail}>
          <section className={styles.railCard}>
            <h2>빠른 실행</h2>
            <div className={styles.quickActions}>
              {detail.phone ? (
                <a className={styles.secondaryButton} href={`tel:${detail.phone}`}>전화하기</a>
              ) : (
                <span aria-disabled="true" className={`${styles.secondaryButton} ${styles.disabledButton}`}>전화하기</span>
              )}
              <Link className={styles.secondaryButton} href={`/admin/workers/${detail.id}/edit`}>수정</Link>
              <Link className={styles.dangerButton} href={`/admin/workers/${detail.id}/edit#archive`}>보관</Link>
              <Link href={`/admin?date=${detail.date}`}>목록으로</Link>
            </div>
          </section>
          <section className={styles.railCard}>
            <h2>오늘 담당 현황</h2>
            <div className={styles.workerMetricGrid}>
              {metrics.map(([label, value, unit, icon, tone]) => (
                <dl className={`${styles.workerMetric} ${tone}`} key={label}>
                  <Image alt="" aria-hidden="true" height={34} src={icon} width={34} />
                  <div><dt>{label}</dt><dd>{value}<span>{unit}</span></dd></div>
                </dl>
              ))}
            </div>
          </section>
          <section className={styles.railCard}>
            <div className={styles.workerCardHeader}><h2>담당 지역</h2><strong>{detail.region}</strong></div>
            <div className={styles.workerRegionMap}>
              <Image alt={`${detail.region} 담당 지역 지도`} fill sizes="420px" src="/admin/map-fallback.png" />
              {detail.subjects.slice(0, 5).map((subject, index) => (
                <Image
                  alt=""
                  aria-hidden="true"
                  className={`${styles.workerMapPin} ${styles[`workerMapPin${index + 1}`]}`}
                  height={32}
                  key={subject.id}
                  src="/admin/map-pin.png"
                  width={24}
                />
              ))}
            </div>
          </section>
          <section className={styles.railCard}>
            <div className={styles.workerCardHeader}><h2>최근 활동</h2><Link href={`/today/log?workerId=${detail.id}&date=${detail.date}`}>전체 보기</Link></div>
            {detail.activities.length ? (
              <ol className={styles.activityList}>
                {detail.activities.map((activity) => (
                  <li key={activity.id}>
                    <Image alt="" aria-hidden="true" height={10} src="/admin/status-resolved.png" width={10} />
                    <span><strong>{activity.subjectName}</strong> 대상자 {activity.label}</span>
                    <time dateTime={`${activity.date}T${activity.time}`}>{activity.time}</time>
                  </li>
                ))}
              </ol>
            ) : <p className={styles.workerEmpty}>최근 활동이 없습니다.</p>}
          </section>
        </aside>
      </main>
    </div>
  );
}
