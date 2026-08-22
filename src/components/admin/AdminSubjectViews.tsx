import Image from "next/image";
import Link from "next/link";
import type { AdminSubjectDetail } from "../../lib/admin/subject-detail";
import { GRADE_LABEL, HOUSEHOLD_STATUS_LABEL, HouseholdStatus, RiskGrade } from "../../lib/domain";
import styles from "./admin-subject.module.css";

type SubjectAction = (form: FormData) => void | Promise<void>;

function maskedPhone(phone: string | null): string {
  if (!phone) return "미등록";
  const [first, , last] = phone.split("-");
  return first && last ? `${first}-****-${last}` : phone;
}

function avatarFor(detail: Pick<AdminSubjectDetail, "birthYear"> | null): string {
  return detail && detail.birthYear % 2 === 0
    ? "/admin/elder-female-1.png"
    : "/admin/elder-male-1.png";
}

export function AdminManagementHeader({ detail, label }: { detail: AdminSubjectDetail | null; label: string }) {
  return (
    <header className={styles.topBar}>
      <Link className={styles.brand} href="/admin">
        <Image alt="" aria-hidden="true" height={32} src="/admin/brand-mark.png" width={32} />
        <span>이 집 먼저</span>
      </Link>
      <nav className={styles.breadcrumb} aria-label="현재 위치">
        <Link href="/admin">대상자 관리</Link><span>›</span><strong>{label}</strong>
      </nav>
      <div className={styles.headerMeta}>
        <dl><Image alt="" aria-hidden="true" height={20} src="/admin/calendar.png" width={20} /><dt>날짜</dt><dd>{(detail?.date ?? "2026-08-22").replaceAll("-", ".")}</dd></dl>
        <dl><Image alt="" aria-hidden="true" height={20} src="/admin/location.png" width={20} /><dt>담당 지역</dt><dd>{detail?.address.split(" ").slice(0, 3).join(" ") ?? "전체 지역"}</dd></dl>
        <dl><Image alt="" aria-hidden="true" height={20} src="/admin/thermometer.png" width={20} /><dt>담당 체감온도</dt><dd className={styles.hot}>{detail?.feelsLikeMax == null ? "—" : `${detail.feelsLikeMax.toFixed(1)}°C`}</dd></dl>
        <dl><Image alt="" aria-hidden="true" height={20} src="/admin/clock.png" width={20} /><dt>마지막 갱신</dt><dd>14:32</dd></dl>
        <dl><Image alt="" aria-hidden="true" height={20} src="/admin/refresh.png" width={20} /><dt>자동 갱신</dt><dd>켜짐</dd></dl>
      </div>
      <div className={styles.alertSteps} aria-label="경보 단계">
        <span>주의</span><span>경보</span><strong>비상</strong>
      </div>
    </header>
  );
}

function GradeBadge({ detail }: { detail: AdminSubjectDetail }) {
  return detail.grade ? (
    <span className={`${styles.badge} ${styles[`grade${detail.grade}`]}`}>{GRADE_LABEL[detail.grade]}</span>
  ) : <span className={styles.badge}>평가 전</span>;
}

function StatusBadge({ detail }: { detail: AdminSubjectDetail }) {
  return <span className={styles.statusBadge}>{detail.statusLabel}</span>;
}

function RiskStrip({ detail }: { detail: AdminSubjectDetail }) {
  return (
    <div className={styles.riskStrip}>
      <Image alt="" aria-hidden="true" height={20} src="/admin/metric-critical.png" width={20} />
      <strong>위험 사유</strong><span>{detail.reasons.length ? detail.reasons.join(" / ") : "당일 위험도 평가 전"}</span>
    </div>
  );
}

function LocationCard({ detail }: { detail: AdminSubjectDetail }) {
  return (
    <section className={styles.railCard}>
      <h2>위치 정보</h2>
      <div className={styles.locationMap}>
        <Image alt="지도 위치" fill loading="eager" sizes="420px" src="/admin/map-fallback.png" />
        <Image alt="" aria-hidden="true" className={styles.locationPin} height={42} src="/admin/map-pin.png" width={32} />
      </div>
      <div className={styles.locationFooter}>
        <strong>{detail.address}</strong>
        <a href={`https://map.kakao.com/link/map/${encodeURIComponent(detail.address)},${detail.building.lat},${detail.building.lng}`} rel="noreferrer" target="_blank">지도에서 보기</a>
      </div>
    </section>
  );
}

export function AdminSubjectDetailView({
  detail,
  deleteAction,
}: {
  detail: AdminSubjectDetail;
  deleteAction?: SubjectAction;
}) {
  const cooling = detail.airconBroken
    ? "점검 필요"
    : detail.hasAircon === true
      ? "정상"
      : detail.hasAircon === false
        ? "없음"
        : "미확인";
  const notes = [
    detail.hasMobilityIssue ? "거동 불편" : null,
    detail.hasChronicDisease ? "기저질환" : null,
  ].filter(Boolean).join(", ") || "미등록";

  return (
    <div className={styles.page}>
      <AdminManagementHeader detail={detail} label="대상자 상세" />
      <main className={styles.detailShell}>
        <div className={styles.detailColumn}>
          <section className={styles.profileCard}>
            <Image alt={`${detail.name} 합성 프로필`} className={styles.profileAvatar} height={160} src={avatarFor(detail)} width={160} />
            <div className={styles.profileCopy}>
              <div className={styles.identityLine}><h1>{detail.name}</h1><GradeBadge detail={detail} /><StatusBadge detail={detail} /></div>
              <dl className={styles.profileFacts}>
                <div><dt>담당자</dt><dd>{detail.workerName}</dd></div>
                <div><dt>연락처</dt><dd>{maskedPhone(detail.phone)}</dd></div>
                <div><dt>주소</dt><dd>{detail.address}</dd></div>
              </dl>
              <RiskStrip detail={detail} />
            </div>
          </section>

          <div className={styles.infoGrid}>
            <section className={styles.infoCard}>
              <h2>기본 정보</h2>
              <dl>
                <div><dt>생년</dt><dd>{detail.birthYear}년 ({detail.age}세)</dd></div>
                <div><dt>가구 유형</dt><dd>{detail.livesAlone ? "독거" : "동거"}</dd></div>
                <div><dt>주택 유형</dt><dd>{detail.building.isDetached ? "단독주택" : detail.building.mainPurpose ?? "공동주택"}</dd></div>
                <div><dt>주택 준공연도</dt><dd>{detail.building.builtYear ? `${detail.building.builtYear}년` : "미등록"}</dd></div>
                <div><dt>연락처</dt><dd>{maskedPhone(detail.phone)}</dd></div>
                <div><dt>비상 연락처</dt><dd>미등록</dd></div>
                <div><dt>특이사항</dt><dd>{notes}</dd></div>
              </dl>
            </section>
            <section className={styles.infoCard}>
              <h2>위험 정보</h2>
              <dl>
                <div><dt>위험 등급</dt><dd><GradeBadge detail={detail} /></dd></div>
                <div><dt>상태</dt><dd><StatusBadge detail={detail} /></dd></div>
                <div><dt>최근 상태 변경</dt><dd>{detail.checks[0]?.createdAt ?? "기록 없음"}</dd></div>
                <div><dt>위험 사유</dt><dd>{detail.reasons.join(" / ") || "평가 전"}</dd></div>
                <div><dt>메모</dt><dd>{detail.checks[0]?.memo ?? "미등록"}</dd></div>
              </dl>
            </section>
            <section className={styles.infoCard}>
              <div className={styles.cardHeading}><h2>설비 점검 현황</h2><Link href={`/admin/subjects/${detail.id}/edit#facility`}>기록하기</Link></div>
              <div className={styles.facilityState}><Image alt="" aria-hidden="true" height={24} src="/admin/refresh.png" width={24} /><span>냉방기 정상작동 유무</span><strong data-tone={cooling === "정상" ? "normal" : "warning"}>{cooling}</strong></div>
              <div className={styles.facilityState}><Image alt="" aria-hidden="true" height={24} src="/admin/thermometer.png" width={24} /><span>난방기 정상작동 유무</span><strong>점검 기록 없음</strong></div>
              <dl className={styles.inspectionMeta}>
                <div><dt>마지막 점검 시각</dt><dd>{detail.checks[0]?.createdAt ?? "기록 없음"}</dd></div>
                <div><dt>점검자</dt><dd>{detail.checks[0]?.workerName ?? "미등록"}</dd></div>
              </dl>
            </section>
          </div>

          <section className={styles.historyCard}>
            <div className={styles.cardHeading}><h2>점검 이력</h2><Link href={`/today/log?workerId=${detail.workerId}`}>전체 이력 보기</Link></div>
            <div className={styles.historyScroller}>
              <table>
                <thead><tr><th>점검 일시</th><th>점검자</th><th>종류</th><th>결과</th><th>메모</th></tr></thead>
                <tbody>
                  {detail.checks.length ? detail.checks.map((check) => (
                    <tr key={check.id}><td>{check.createdAt}</td><td>{check.workerName}</td><td>{check.kind}</td><td>{check.result}</td><td>{check.memo ?? "-"}</td></tr>
                  )) : <tr><td colSpan={5}>점검 이력이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className={styles.detailRail}>
          <section className={styles.railCard}>
            <h2>빠른 실행</h2>
            <div className={styles.quickActions}>
              <Link className={styles.primaryButton} href={`/admin/subjects/${detail.id}/edit#facility`}>설비 점검 기록</Link>
              <Link href={`/admin/subjects/${detail.id}/edit`}>수정</Link>
              <a className={styles.dangerButton} href="#delete">삭제</a>
              <Link href="/admin">목록으로</Link>
            </div>
          </section>
          <section className={styles.railCard}>
            <h2>담당 생활지원사</h2>
            <div className={styles.workerCard}>
              <Image alt={`${detail.workerName} 합성 프로필`} height={72} src="/admin/elder-female-2.png" width={72} />
              <div><strong>{detail.workerName}</strong><span>생활지원사</span><p>연락처 {maskedPhone(detail.workerPhone)}</p><p>소속 지역 행정복지센터</p></div>
            </div>
            <a className={styles.messageButton} href={detail.workerPhone ? `sms:${detail.workerPhone}` : undefined}>메시지 보내기</a>
          </section>
          <LocationCard detail={detail} />
          {deleteAction ? (
            <form action={deleteAction} className={styles.deletePanel} id="delete">
              <p>대상자를 삭제하면 기존 점검 기록도 함께 삭제됩니다.</p>
              <button type="submit">대상자 삭제</button>
            </form>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

function TriStateSelect({ name, value }: { name: string; value: boolean | null }) {
  return (
    <select defaultValue={value === null ? "unknown" : String(value)} name={name}>
      <option value="unknown">미확인</option><option value="true">있음</option><option value="false">없음</option>
    </select>
  );
}

export function AdminSubjectFormView({
  action,
  detail,
  mode,
  workers = detail?.workers ?? [],
  buildings = detail?.buildings ?? [],
  deleteAction,
}: {
  action: SubjectAction;
  detail: AdminSubjectDetail | null;
  mode: "new" | "edit";
  workers?: AdminSubjectDetail["workers"];
  buildings?: AdminSubjectDetail["buildings"];
  deleteAction?: SubjectAction;
}) {
  const title = mode === "edit" ? "대상자 수정" : "대상자 등록";
  const selectedAircon = detail?.airconBroken || detail?.hasAircon === false
    ? "issue"
    : detail?.hasAircon === true ? "normal" : "unknown";

  return (
    <div className={styles.page}>
      <AdminManagementHeader detail={detail} label={title} />
      <form action={action}>
        <div className={styles.formActions}>
          <Link href={detail ? `/admin/subjects/${detail.id}` : "/admin"}>취소</Link>
          <button className={styles.secondaryButton} type="submit">임시 저장</button>
          <button className={styles.primaryButton} type="submit">저장</button>
          {deleteAction ? <button className={styles.dangerButton} formAction={deleteAction} type="submit">삭제</button> : null}
        </div>
        <main className={styles.formShell}>
          <div className={styles.formColumn}>
            <div className={styles.formTopGrid}>
              <section className={styles.formCard}>
                <h1>① 기본 정보</h1>
                <div className={styles.fieldGrid}>
                  <label><span>대상자 이름 *</span><input defaultValue={detail?.name ?? ""} maxLength={20} name="name" required /></label>
                  <label><span>생년 *</span><input defaultValue={detail?.birthYear ?? ""} max={1961} min={1906} name="birthYear" required type="number" /></label>
                  <label><span>연락처</span><input defaultValue={detail?.phone ?? ""} name="phone" pattern="010-[0-9]{4}-[0-9]{4}" placeholder="010-0000-0000" /></label>
                  <label><span>가구 유형 *</span><select defaultValue={String(detail?.livesAlone ?? true)} name="livesAlone"><option value="true">독거</option><option value="false">동거</option></select></label>
                  <label className={styles.wideField}><span>주소 *</span><select defaultValue={detail?.buildingId ?? ""} name="buildingId" required><option disabled value="">건물 선택</option>{buildings.map((building) => <option key={building.id} value={building.id}>{building.roadAddress ?? building.address}</option>)}</select></label>
                  <label><span>거동 불편</span><TriStateSelect name="hasMobilityIssue" value={detail?.hasMobilityIssue ?? null} /></label>
                  <label><span>기저질환</span><TriStateSelect name="hasChronicDisease" value={detail?.hasChronicDisease ?? null} /></label>
                  <label><span>비상 연락처</span><input disabled placeholder="미등록 (DB 필드 없음)" /></label>
                </div>
              </section>
              <section className={styles.formCard}>
                <h1>② 위험/관제 정보</h1>
                <fieldset className={styles.readonlyGrades}><legend>위험 등급 · 자동 계산</legend>{Object.values(RiskGrade).map((grade) => <label key={grade}><input checked={detail?.grade === grade} disabled readOnly type="radio" />{GRADE_LABEL[grade]}</label>)}</fieldset>
                <label><span>상태 · 점검 기록에 따라 변경</span><select disabled value={detail?.status ?? HouseholdStatus.UNCHECKED}>{Object.values(HouseholdStatus).map((status) => <option key={status} value={status}>{HOUSEHOLD_STATUS_LABEL[status]}</option>)}</select></label>
                <label><span>담당자 *</span><select defaultValue={detail?.workerId ?? ""} name="workerId" required><option disabled value="">담당자 선택</option>{workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>
                <label><span>위험 사유 · 스코어링 결과</span><textarea readOnly rows={3} value={detail?.reasons.join(" / ") ?? "대상자 등록 후 경보 발령 시 계산됩니다."} /></label>
              </section>
            </div>
            <section className={styles.formCard} id="facility">
              <h1>③ 설비 점검 정보</h1>
              <div className={styles.facilityFormGrid}>
                <fieldset><legend>냉방기 정상작동 유무 *</legend>{[["normal", "정상"], ["issue", "점검 필요"], ["unknown", "없음/미확인"]].map(([value, label]) => <label key={value}><input defaultChecked={selectedAircon === value} name="airconStatus" type="radio" value={value} />{label}</label>)}</fieldset>
                <label><span>점검 일시</span><input disabled value={detail?.checks[0]?.createdAt ?? "기록 없음"} /></label>
                <label><span>점검자</span><input disabled value={detail?.checks[0]?.workerName ?? "미등록"} /></label>
                <fieldset disabled><legend>난방기 정상작동 유무</legend><label><input type="radio" />정상</label><label><input type="radio" />점검 필요</label><label><input checked readOnly type="radio" />기록 없음</label></fieldset>
                <label className={styles.wideField}><span>점검 메모</span><textarea disabled rows={2} value={detail?.checks[0]?.memo ?? "점검 기록에서 관리됩니다."} /></label>
              </div>
            </section>
          </div>
          <aside className={styles.formRail}>
            <section className={styles.railCard}>
              <h2>대상자 요약</h2>
              <div className={styles.summaryIdentity}><Image alt="합성 프로필" height={96} src={avatarFor(detail)} width={96} /><div><strong>{detail?.name ?? "새 대상자"}</strong>{detail ? <><GradeBadge detail={detail} /><StatusBadge detail={detail} /></> : null}</div></div>
              {detail ? <RiskStrip detail={detail} /> : <p>저장 후 위험도 요약이 표시됩니다.</p>}
            </section>
            {detail ? <LocationCard detail={detail} /> : null}
            <section className={styles.railCard}><h2>최근 점검 요약</h2>{detail?.checks.length ? detail.checks.slice(0, 2).map((check) => <p key={check.id}><strong>{check.kind}</strong> · {check.result} · {check.createdAt}</p>) : <p>점검 기록이 없습니다.</p>}</section>
          </aside>
        </main>
      </form>
    </div>
  );
}
