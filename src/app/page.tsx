export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="text-center">
        <p className="text-lg text-red-700 font-semibold">
          폭염·한파 취약노인 관제
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">이 집 먼저</h1>
        <p className="mt-4 max-w-md text-lg leading-8 text-zinc-600">
          오늘 누가 위험한지, 누구부터 확인할지, 언제 방문으로 전환할지
          정해주는 시스템. 평소에는 조용합니다.
        </p>
      </header>

      <nav className="flex w-full max-w-sm flex-col gap-4">
        {/* /today, /admin 구현 전까지 진입점 안내만 표시 (docs/architecture.md §7) */}
        <div className="rounded-2xl border border-zinc-200 p-5">
          <p className="text-sm font-medium text-zinc-500">담당자 (생활지원사)</p>
          <p className="mt-1 text-xl font-semibold">
            오늘의 대응 보드 <span className="text-sm font-normal text-zinc-400">— 준비 중</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 p-5">
          <p className="text-sm font-medium text-zinc-500">관리자 (전담사회복지사)</p>
          <p className="mt-1 text-xl font-semibold">
            관제 대시보드 <span className="text-sm font-normal text-zinc-400">— 준비 중</span>
          </p>
        </div>
      </nav>

      <footer className="text-sm text-zinc-400">
        JunctionX Korea 2026 · 48h MVP
      </footer>
    </main>
  );
}
