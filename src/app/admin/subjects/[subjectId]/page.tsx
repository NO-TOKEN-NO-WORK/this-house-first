import { notFound } from "next/navigation";
import { AdminSubjectDetailView } from "../../../../components/admin/AdminSubjectViews";
import { getAdminSubjectDetail } from "../../../../lib/admin/subject-detail";
import { isIsoDate } from "../../../../lib/board/format";
import { deleteSubject } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const [{ subjectId }, query] = await Promise.all([params, searchParams]);
  const date = Array.isArray(query.date) ? null : query.date;
  if (date !== undefined && !isIsoDate(date)) notFound();
  const detail = await getAdminSubjectDetail(subjectId, date);
  if (!detail) notFound();

  return (
    <AdminSubjectDetailView
      deleteAction={deleteSubject.bind(null, subjectId)}
      detail={detail}
    />
  );
}
