/**
 * 주소로 직접 들어온 상세만 서버를 기다린다.
 * 보드에서 누른 경로는 이 파일을 타지 않는다.
 */
export default function SubjectDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col bg-surface-default">
      <header className="sticky top-0 z-30 grid h-[calc(53px_+_var(--safe-top))] grid-cols-[44px_1fr_44px] items-center bg-surface-default px-1.5 pt-[var(--safe-top)]">
        <span aria-hidden />
        <h1 className="text-center text-label-15 text-text-primary">
          대상자 정보
        </h1>
        <span aria-hidden />
      </header>

      <main
        aria-busy="true"
        aria-describedby="subject-detail-loading-status"
        className="flex flex-1 flex-col gap-5 px-5 py-6 pb-10"
      >
        <p id="subject-detail-loading-status" role="status" className="sr-only">
          대상자 정보를 불러오는 중입니다.
        </p>

        <div
          aria-hidden="true"
          className="flex animate-pulse flex-col gap-5 motion-reduce:animate-none"
        >
          <section className="flex flex-col gap-3">
            <span className="h-7 w-14 rounded-full bg-background-subtle" />
            <div className="flex items-end gap-3">
              <span className="h-9 w-28 rounded-lg bg-background-subtle" />
              <span className="mb-1 h-5 w-20 rounded-md bg-background-subtle" />
            </div>
            <div className="flex gap-3">
              <span className="h-5 w-32 rounded-md bg-background-subtle" />
              <span className="h-5 min-w-0 flex-1 rounded-md bg-background-subtle" />
            </div>
          </section>

          <section className="rounded-xl border border-border-subtle p-4">
            <span className="block h-5 w-20 rounded-md bg-background-subtle" />
            <div className="mt-4 flex flex-col gap-3">
              <span className="h-5 w-full rounded-md bg-background-subtle" />
              <span className="h-5 w-5/6 rounded-md bg-background-subtle" />
              <span className="h-5 w-3/4 rounded-md bg-background-subtle" />
            </div>
          </section>

          <section className="rounded-xl border border-border-subtle p-4">
            <span className="block h-5 w-28 rounded-md bg-background-subtle" />
            <div className="mt-4 flex flex-col gap-3">
              <span className="h-5 w-full rounded-md bg-background-subtle" />
              <span className="h-5 w-4/5 rounded-md bg-background-subtle" />
              <span className="h-5 w-2/3 rounded-md bg-background-subtle" />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
