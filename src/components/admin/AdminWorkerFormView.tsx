import Link from "next/link";
import { AdminManagementHeader } from "./AdminSubjectViews";
import styles from "./admin-subject.module.css";

type WorkerAction = (form: FormData) => void | Promise<void>;

export function AdminWorkerFormView({
  action,
  deleteAction,
  worker,
}: {
  action: WorkerAction;
  deleteAction?: WorkerAction;
  worker: { name: string; phone: string | null; assigned: number; checks: number } | null;
}) {
  const title = worker ? "생활지원사 수정" : "생활지원사 등록";
  const canDelete = worker && worker.assigned === 0 && worker.checks === 0;
  return (
    <div className={styles.page}>
      <AdminManagementHeader detail={null} label={title} />
      <form action={action}>
        <div className={styles.formActions}>
          <Link href="/admin">취소</Link>
          <button className={styles.primaryButton} type="submit">저장</button>
          {deleteAction ? (
            <button
              className={styles.dangerButton}
              disabled={!canDelete}
              formAction={deleteAction}
              title={canDelete ? undefined : "담당 대상자나 점검 기록이 있어 삭제할 수 없습니다."}
              type="submit"
            >삭제</button>
          ) : null}
        </div>
        <main className={styles.workerFormShell}>
          <section className={styles.formCard}>
            <h1>생활지원사 기본 정보</h1>
            <div className={styles.fieldGrid}>
              <label><span>이름 *</span><input defaultValue={worker?.name ?? ""} maxLength={20} name="name" required /></label>
              <label><span>연락처</span><input defaultValue={worker?.phone ?? ""} name="phone" pattern="010-[0-9]{4}-[0-9]{4}" placeholder="010-0000-0000" /></label>
              <label><span>담당 대상자 수</span><input disabled value={`${worker?.assigned ?? 0}명`} /></label>
              <label><span>점검 기록 수</span><input disabled value={`${worker?.checks ?? 0}건`} /></label>
            </div>
            {worker && !canDelete ? <p className={styles.formNotice}>담당 대상자 또는 점검 기록이 있어 삭제할 수 없습니다. 먼저 담당자를 변경해 주세요.</p> : null}
          </section>
        </main>
      </form>
    </div>
  );
}
