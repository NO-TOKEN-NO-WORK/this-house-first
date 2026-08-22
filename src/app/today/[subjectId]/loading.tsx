/**
 * 주소로 직접 들어온 상세만 서버를 기다린다.
 * 보드에서 누른 경로는 이 파일을 타지 않는다.
 */
export default function SubjectDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col bg-surface">
      <header className="sticky top-0 z-30 flex h-[53px] items-center gap-2.5 border-b border-line bg-white px-3.5">
        <span className="size-11" />
        <h1 className="text-base font-bold text-ink">대상자 상세</h1>
      </header>
      <main className="flex flex-1 flex-col gap-5 px-5 py-6">
        <p className="text-[15px] text-ink-soft">불러오는 중</p>
      </main>
    </div>
  );
}
