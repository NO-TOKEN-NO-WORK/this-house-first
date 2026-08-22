import { AdminSubjectFormView } from "../../../../components/admin/AdminSubjectViews";
import { getAdminSubjectOptions } from "../../../../lib/admin/subject-detail";
import { createSubject } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminSubjectNewPage() {
  const { workers, buildings } = await getAdminSubjectOptions();
  return (
    <AdminSubjectFormView
      action={createSubject}
      buildings={buildings}
      detail={null}
      mode="new"
      workers={workers}
    />
  );
}
