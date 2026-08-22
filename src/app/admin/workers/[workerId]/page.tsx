import { notFound } from "next/navigation";
import { AdminWorkerDetailView } from "../../../../components/admin/AdminWorkerDetailView";
import { getAdminWorkerDetail } from "../../../../lib/admin/worker-detail";
import { isIsoDate } from "../../../../lib/board/format";
import { isHouseholdStatus, type HouseholdStatus } from "../../../../lib/domain";

export const dynamic = "force-dynamic";

export function normalizeWorkerDetailSearchParams(params: {
  date?: string | string[];
  subjectQuery?: string | string[];
  status?: string | string[];
}): {
  date?: string;
  subjectQuery?: string;
  selectedStatus?: HouseholdStatus;
} | null {
  if (
    Array.isArray(params.date) ||
    Array.isArray(params.subjectQuery) ||
    Array.isArray(params.status)
  ) return null;
  if (params.date !== undefined && !isIsoDate(params.date)) return null;
  if (
    params.status !== undefined &&
    params.status !== "all" &&
    !isHouseholdStatus(params.status)
  ) return null;

  return {
    ...(params.date ? { date: params.date } : {}),
    ...(params.subjectQuery
      ? { subjectQuery: params.subjectQuery.slice(0, 50) }
      : {}),
    ...(params.status && params.status !== "all"
      ? { selectedStatus: params.status }
      : {}),
  };
}

export default async function AdminWorkerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workerId: string }>;
  searchParams: Promise<{
    date?: string | string[];
    subjectQuery?: string | string[];
    status?: string | string[];
  }>;
}) {
  const [{ workerId }, query] = await Promise.all([params, searchParams]);
  const filters = normalizeWorkerDetailSearchParams(query);
  if (!filters) notFound();
  const detail = await getAdminWorkerDetail(workerId, filters.date);
  if (!detail) notFound();

  return (
    <AdminWorkerDetailView
      detail={detail}
      selectedStatus={filters.selectedStatus}
      subjectQuery={filters.subjectQuery}
    />
  );
}
