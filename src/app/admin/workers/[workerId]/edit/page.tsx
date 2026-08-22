import { notFound } from "next/navigation";
import { AdminWorkerFormView } from "../../../../../components/admin/AdminWorkerFormView";
import { prisma } from "../../../../../lib/db";
import { WorkerRole } from "../../../../../lib/domain";
import { deleteWorker, updateWorker } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function AdminWorkerEditPage({
  params,
}: {
  params: Promise<{ workerId: string }>;
}) {
  const { workerId } = await params;
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: { _count: { select: { subjects: true, checkEvents: true } } },
  });
  if (!worker || worker.role !== WorkerRole.WORKER) notFound();

  return (
    <AdminWorkerFormView
      action={updateWorker.bind(null, workerId)}
      deleteAction={deleteWorker.bind(null, workerId)}
      worker={{
        name: worker.name,
        phone: worker.phone,
        assigned: worker._count.subjects,
        checks: worker._count.checkEvents,
      }}
    />
  );
}
