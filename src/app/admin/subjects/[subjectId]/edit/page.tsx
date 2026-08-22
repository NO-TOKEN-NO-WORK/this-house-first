import { notFound } from "next/navigation";
import { AdminSubjectFormView } from "../../../../../components/admin/AdminSubjectViews";
import { getAdminSubjectDetail } from "../../../../../lib/admin/subject-detail";
import { archiveSubject, updateSubject } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function AdminSubjectEditPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const detail = await getAdminSubjectDetail(subjectId);
  if (!detail) notFound();

  return (
    <AdminSubjectFormView
      action={updateSubject.bind(null, subjectId)}
      archiveAction={archiveSubject.bind(null, subjectId)}
      detail={detail}
      mode="edit"
    />
  );
}
