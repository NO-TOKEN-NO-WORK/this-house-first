import { AdminWorkerFormView } from "../../../../components/admin/AdminWorkerFormView";
import { createWorker } from "../../actions";

export default function AdminWorkerNewPage() {
  return <AdminWorkerFormView action={createWorker} worker={null} />;
}
