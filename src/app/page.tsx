import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="text-center">
        <p className="text-label-18 text-status-critical-strong">
          폭염·한파 취약노인 관제
        </p>
        <h1 className="mt-2 text-display-28 tracking-tight">이 집 먼저</h1>
        <p className="mt-4 max-w-md text-body-18 leading-8 text-text-secondary">
          오늘 누가 위험한지, 누구부터 확인할지, 언제 방문으로 전환할지
          정해주는 시스템. 평소에는 조용합니다.
        </p>
      </header>

      <nav className="flex w-full max-w-sm flex-col gap-4">
        <Link
          href="/today"
          className="rounded-2xl border border-border-default p-5 active:bg-background-subtle"
        >
          <p className="text-label-14 text-text-tertiary">담당자 (생활지원사)</p>
          <p className="mt-1 text-heading-20">오늘의 대응 보드</p>
        </Link>
        <Link
          href="/admin"
          className="rounded-2xl border border-border-default p-5 active:bg-background-subtle"
        >
          <p className="text-label-14 text-text-tertiary">관리자 (전담사회복지사)</p>
          <p className="mt-1 text-heading-20">관제 대시보드</p>
        </Link>
      </nav>

      <footer className="text-body-14 text-text-tertiary">
        JunctionX Korea 2026 · 48h MVP
      </footer>
    </main>
  );
}
