"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CurrentWeatherSummary } from "@/components/CurrentWeatherSummary";
import {
  RecommendationStatus,
  RECOMMENDATION_STATUS_LABEL,
  WelfareIssue,
  type WelfareIssue as WelfareIssueCode,
  type WelfareRecommendation,
} from "@/lib/welfare-scan/eligibility";
import { AdminShell, AdminTopBar } from "./AdminShell";
import styles from "./welfare-scan.module.css";

const ISSUE_LABEL: Record<WelfareIssueCode, string> = {
  [WelfareIssue.COOLING_ISSUE]: "냉방기 고장",
  [WelfareIssue.ENERGY_COST]: "에너지 비용 부담",
  [WelfareIssue.MOBILITY]: "거동·이동 어려움",
  [WelfareIssue.SAFETY_EQUIPMENT]: "안전 설비 필요",
  [WelfareIssue.HOUSING_REPAIR]: "주거 수선 필요",
};

const DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

type ConnectionState = {
  publicData: ConnectionStatusState;
  ai: ConnectionStatusState;
};

type ConnectionStatusState = { ok: boolean; message: string; reason?: string };

type ScanPayload = {
  data?: {
    recommendations?: WelfareRecommendation[];
    scannedCount?: number;
    programCount?: number;
    partial?: boolean;
    scannedAt?: string;
    connections?: ConnectionState;
  };
  error?: { message?: string };
};

function recommendationKey(item: WelfareRecommendation): string {
  return `${item.subjectId}:${item.programId}`;
}

function formatTime(value: string | null): string {
  if (!value) return "아직 실행하지 않음";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: WelfareRecommendation["status"] }) {
  return (
    <span className={styles.statusBadge} data-status={status}>
      {RECOMMENDATION_STATUS_LABEL[status]}
    </span>
  );
}

export function ConnectionStatus({
  state,
  fallback,
}: {
  state?: ConnectionStatusState;
  fallback: string;
}) {
  const reason = state && !state.ok ? state.reason : undefined;
  return (
    <span title={reason}>
      <Image alt="" aria-hidden="true" height={12} src={state?.ok ? "/admin/status-resolved.png" : "/admin/status-unreachable.png"} width={12} />
      {state?.message ?? fallback}
      {reason ? <span className={styles.srOnly}> 상세 원인: {reason}</span> : null}
    </span>
  );
}

export function WelfareScanWorkspace({
  initialRecommendations = [],
  previewMode = false,
}: {
  initialRecommendations?: WelfareRecommendation[];
  previewMode?: boolean;
}) {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [phase, setPhase] = useState<"idle" | "scanning" | "success" | "error">(
    initialRecommendations.length > 0 ? "success" : "idle",
  );
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState(
    previewMode ? "미리보기 데이터입니다. 스캔을 실행하면 실제 결과로 대체됩니다." : "",
  );
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [programCount, setProgramCount] = useState(0);
  const [connections, setConnections] = useState<ConnectionState | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(
    previewMode && initialRecommendations[0]
      ? recommendationKey(initialRecommendations[0])
      : null,
  );
  const [reviewed, setReviewed] = useState<Set<string>>(new Set<string>());
  const [statusFilter, setStatusFilter] = useState("all");
  const [issueFilter, setIssueFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    return recommendations.filter((item) => {
      const key = recommendationKey(item);
      return (
        (statusFilter === "all" ||
          (statusFilter === "reviewed" ? reviewed.has(key) : item.status === statusFilter)) &&
        (issueFilter === "all" || item.issues.includes(issueFilter as WelfareIssueCode)) &&
        (programFilter === "all" || item.programId === programFilter) &&
        (workerFilter === "all" || item.workerName === workerFilter) &&
        (!normalized || item.subjectName.toLocaleLowerCase("ko-KR").includes(normalized))
      );
    });
  }, [issueFilter, programFilter, query, recommendations, reviewed, statusFilter, workerFilter]);

  const selected = recommendations.find(
    (item) => recommendationKey(item) === selectedKey,
  );
  const workers = Array.from(new Set(recommendations.map((item) => item.workerName)));
  const programs = Array.from(
    new Map(recommendations.map((item) => [item.programId, item.programName])).entries(),
  );

  async function runScan() {
    setPhase("scanning");
    setNotice("대상자 기록과 복지사업을 비교하고 있습니다.");
    setSelectedKey(null);
    try {
      const response = await fetch("/api/welfare-scan", { method: "POST" });
      const payload = (await response.json()) as ScanPayload;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message || "복지 스캔을 실행하지 못했습니다.");
      }
      const next = payload.data.recommendations ?? [];
      setRecommendations(next);
      setReviewed(new Set<string>());
      setScannedAt(payload.data.scannedAt ?? new Date().toISOString());
      setScannedCount(payload.data.scannedCount ?? 0);
      setProgramCount(payload.data.programCount ?? 0);
      setConnections(payload.data.connections ?? null);
      setPhase("success");
      setNotice(
        payload.data.partial
          ? "일부 연동이 실패했습니다. 성공한 데이터만 표시합니다."
          : `${next.length}건의 복지 제안을 찾았습니다.`,
      );
      if (next[0]) setSelectedKey(recommendationKey(next[0]));
    } catch (error) {
      setPhase("error");
      setNotice(error instanceof Error ? error.message : "복지 스캔을 실행하지 못했습니다.");
    }
  }

  async function syncPrograms() {
    setSyncing(true);
    setNotice("복지로의 최신 중앙부처 복지사업을 확인하고 있습니다.");
    try {
      const response = await fetch("/api/welfare-scan");
      const payload = (await response.json()) as {
        data?: { count?: number };
        error?: { message?: string };
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message || "복지사업 정보를 새로고침하지 못했습니다.");
      }
      setNotice(`${payload.data.count ?? 0}개 관련 복지사업을 새로 확인했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "복지사업 정보를 새로고침하지 못했습니다.");
    } finally {
      setSyncing(false);
    }
  }

  function markReviewed(item: WelfareRecommendation) {
    const key = recommendationKey(item);
    setReviewed((current) => new Set(current).add(key));
    setNotice(`${item.subjectName} 대상자의 제안을 검토 완료로 표시했습니다.`);
    setSelectedKey(null);
  }

  function exclude(item: WelfareRecommendation) {
    const key = recommendationKey(item);
    setRecommendations((current) => current.filter((row) => recommendationKey(row) !== key));
    setNotice(`${item.subjectName} 대상자의 제안을 목록에서 제외했습니다.`);
    setSelectedKey(null);
  }

  const highCount = recommendations.filter(
    (item) => item.status === RecommendationStatus.HIGH,
  ).length;
  const needsInfoCount = recommendations.filter(
    (item) => item.status === RecommendationStatus.NEEDS_INFO,
  ).length;

  return (
    <AdminShell
      activePage="welfare-scan"
      header={<AdminTopBar
        items={[
          { icon: "/admin/calendar.png", label: "날짜", value: previewMode ? "2026.08.22" : DATE_FORMAT.format(new Date()) },
          { icon: "/admin/location.png", label: "담당 지역", value: "전체 담당 지역" },
          { icon: "/admin/clock.png", label: "마지막 스캔", value: formatTime(scannedAt) },
          { icon: "/admin/refresh.png", label: "분석 방식", value: "수동 실행" },
        ]}
        metaTail={<CurrentWeatherSummary valuesOnly variant="admin" />}
        title="복지 스캔"
      />}
      pageClassName={styles.page}
      previewMode={previewMode}
    >
      <main className={styles.main}>
          <section className={styles.hero}>
            <p>현장 기록과 대상자 상태를 바탕으로 연결 가능한 공공 복지사업을 찾습니다.</p>
            <div className={styles.heroActions}>
              <button className={styles.primaryButton} disabled={phase === "scanning"} onClick={runScan} type="button">
                {phase === "scanning" ? "복지 스캔 진행 중" : "복지 스캔 시작"}
              </button>
              <button className={styles.secondaryButton} disabled={syncing} onClick={syncPrograms} type="button">
                {syncing ? "정보 확인 중" : "복지사업 정보 새로고침"}
              </button>
            </div>
          </section>

          <section className={styles.statusStrip} aria-label="복지 스캔 연결 상태">
            <span>마지막 스캔: <strong>{formatTime(scannedAt)}</strong></span>
            <span>분석 대상자: <strong>{scannedCount || "-"}명</strong></span>
            <span>복지사업: <strong>{programCount || "-"}개</strong></span>
            <ConnectionStatus fallback="공공데이터 확인 전" state={connections?.publicData} />
            <ConnectionStatus fallback="AI 분석 확인 전" state={connections?.ai} />
          </section>

          {notice ? (
            <p className={phase === "error" ? styles.errorNotice : styles.notice} aria-live="polite">
              {notice}
            </p>
          ) : null}

          {phase === "scanning" ? (
            <section className={styles.progressPanel} aria-live="polite">
              <div>
                <strong>복지 스캔 진행 중</strong>
                <span>대상자 사실 확인 → 현장 메모 분석 → 복지사업 자격 비교</span>
              </div>
              <progress aria-label="복지 스캔 진행 중" />
            </section>
          ) : null}

          <section className={styles.metrics} aria-label="복지 스캔 요약">
            {[
              ["새로운 제안", recommendations.length - reviewed.size, "/admin/metric-open.png", "new"],
              ["가능성 높음", highCount, "/admin/metric-completed.png", "high"],
              ["추가 정보 필요", needsInfoCount, "/admin/metric-visit.png", "info"],
              ["제외 가능성 있음", 0, "/admin/status-unreachable.png", "excluded"],
              ["검토 완료", reviewed.size, "/admin/metric-critical.png", "reviewed"],
            ].map(([label, value, icon, tone]) => (
              <dl className={styles.metric} data-tone={tone} key={String(label)}>
                <Image alt="" aria-hidden="true" height={56} src={String(icon)} width={56} />
                <div><dt>{label}</dt><dd>{value}<span>명</span></dd></div>
              </dl>
            ))}
          </section>

          <section className={styles.tablePanel} aria-label="복지 제안 검토 목록">
            <header className={styles.tableHeader}>
              <div><h2>복지 제안 검토</h2><span>대상자별 자격과 현장 근거를 확인하세요.</span></div>
              <p className={styles.resultMeta}>활성 필터: {statusFilter === "all" && issueFilter === "all" && programFilter === "all" && workerFilter === "all" && !query ? "전체" : "적용됨"} <strong>전체 결과 {filtered.length}건</strong></p>
            </header>
            <section className={styles.filters} aria-label="복지 제안 필터">
              <select aria-label="상태" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="all">상태 · 전체</option>
                <option value={RecommendationStatus.HIGH}>가능성 높음</option>
                <option value={RecommendationStatus.NEEDS_INFO}>추가 정보 필요</option>
                <option value="reviewed">검토 완료</option>
              </select>
              <select aria-label="문제 유형" onChange={(event) => setIssueFilter(event.target.value)} value={issueFilter}>
                <option value="all">문제 유형 · 전체</option>
                {Object.entries(ISSUE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label="추천 사업" onChange={(event) => setProgramFilter(event.target.value)} value={programFilter}>
                <option value="all">추천 사업 · 전체</option>
                {programs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <select aria-label="담당 생활지원사" onChange={(event) => setWorkerFilter(event.target.value)} value={workerFilter}>
                <option value="all">담당 생활지원사 · 전체</option>
                {workers.map((worker) => <option key={worker} value={worker}>{worker}</option>)}
              </select>
              <label className={styles.searchField}>
                <span className={styles.srOnly}>대상자 이름 검색</span>
                <input onChange={(event) => setQuery(event.target.value)} placeholder="대상자 이름 검색" type="search" value={query} />
                <Image alt="" aria-hidden="true" height={16} src="/admin/search.png" width={16} />
              </label>
              <button className={styles.resetButton} onClick={() => {
                setStatusFilter("all"); setIssueFilter("all"); setProgramFilter("all"); setWorkerFilter("all"); setQuery("");
              }} type="button">초기화</button>
            </section>
            {filtered.length === 0 ? (
              <div className={styles.emptyState}>
                <Image alt="" aria-hidden="true" height={64} src="/admin/search.png" width={64} />
                <strong>{phase === "idle" ? "아직 복지 스캔 결과가 없습니다" : "조건에 맞는 제안이 없습니다"}</strong>
                <p>{phase === "idle" ? "상단의 복지 스캔 시작 버튼으로 대상자 기록을 분석해 보세요." : "필터를 초기화하거나 다시 스캔해 보세요."}</p>
                {phase === "idle" ? <button className={styles.primaryButton} onClick={runScan} type="button">첫 복지 스캔 시작</button> : null}
              </div>
            ) : (
              <div className={styles.tableScroller}>
                <table className={styles.table}>
                  <thead><tr><th>대상자</th><th>담당 생활지원사</th><th>감지된 문제</th><th>현장 기록 근거</th><th>추천 복지사업</th><th>판정</th><th>상세 보기</th></tr></thead>
                  <tbody>
                    {filtered.map((item) => {
                      const key = recommendationKey(item);
                      return (
                        <tr key={key} data-reviewed={reviewed.has(key)}>
                          <td><strong>{item.subjectName}</strong></td>
                          <td>{item.workerName}</td>
                          <td>{item.issues.map((issue) => ISSUE_LABEL[issue]).join(" · ")}</td>
                          <td className={styles.evidenceCell}>{item.evidence.join(" · ") || "근거 확인 필요"}</td>
                          <td>{item.programName}</td>
                          <td>{reviewed.has(key) ? <span className={styles.reviewedBadge}>검토 완료</span> : <StatusBadge status={item.status} />}</td>
                          <td><button className={styles.viewButton} onClick={() => setSelectedKey(key)} type="button">보기</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
      </main>

      {selected ? (
        <>
          <button aria-label="상세 패널 닫기" className={styles.drawerBackdrop} onClick={() => setSelectedKey(null)} type="button" />
          <aside className={styles.drawer} aria-label={`${selected.subjectName} 복지 제안 상세`}>
            <header className={styles.drawerHeader}>
              <div><h2>{selected.subjectName}</h2><strong>{ISSUE_LABEL[selected.issues[0]] ?? "복지 지원 검토"}</strong></div>
              <button onClick={() => setSelectedKey(null)} type="button">닫기</button>
              <p>담당 {selected.workerName} · 최근 분석 결과</p>
              <StatusBadge status={selected.status} />
            </header>
            <div className={styles.drawerBody}>
              <section className={styles.reasonGrid}>
                <div>
                  <h3>추천 근거</h3>
                  <p>{selected.programSummary}</p>
                  <blockquote>“{selected.evidence.join(" · ") || "현장 기록 근거 확인 필요"}”</blockquote>
                </div>
                <div className={styles.programCard}>
                  <h3>추천 복지사업</h3>
                  <dl><dt>사업명</dt><dd>{selected.programName}</dd><dt>소관</dt><dd>{selected.ministry}</dd></dl>
                  <a href={selected.programLink} rel="noreferrer" target="_blank">공식 정보 보기</a>
                </div>
              </section>
              <section>
                <h3>자격 확인</h3>
                <div className={styles.eligibilityGrid}>
                  <div data-kind="confirmed"><h4>확인된 조건</h4><ul>{selected.confirmedChecks.length > 0 ? selected.confirmedChecks.map((check) => <li key={check}>{check}</li>) : <li>확인된 조건 없음</li>}</ul></div>
                  <div data-kind="missing"><h4>추가 확인 필요</h4><ul>{selected.missingChecks.length > 0 ? selected.missingChecks.map((check) => <li key={check}>{check}</li>) : <li>추가 확인 항목 없음</li>}</ul></div>
                  <div data-kind="excluded"><h4>제외 가능 조건</h4><ul><li>최근 동일 사업 지원 여부</li><li>사업별 중복 수혜 제한</li></ul></div>
                </div>
              </section>
              <p className={styles.disclaimer}>본 제안은 검토를 돕기 위한 참고 정보입니다. 실제 수급 여부는 담당 기관의 최신 기준과 대상자 사실 확인을 거쳐 결정합니다.</p>
            </div>
            <footer className={styles.drawerActions}>
              <button className={styles.secondaryButton} onClick={() => setNotice(`${selected.subjectName} 대상자의 자격정보를 담당자에게 확인해 주세요.`)} type="button">자격정보 입력</button>
              <button className={styles.confirmButton} onClick={() => markReviewed(selected)} type="button">연계 대상으로 확정</button>
              <button className={styles.secondaryButton} onClick={() => exclude(selected)} type="button">대상 아님</button>
              <button className={styles.secondaryButton} onClick={runScan} type="button">다시 분석</button>
            </footer>
          </aside>
        </>
      ) : null}
    </AdminShell>
  );
}
