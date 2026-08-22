"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/db";
import { WorkerRole } from "../../lib/domain";
import { parseSubjectForm, parseWorkerForm } from "../../lib/admin/management";

function refreshAdmin() {
  revalidatePath("/admin");
}

export async function createSubject(form: FormData) {
  const subject = await prisma.subject.create({ data: parseSubjectForm(form) });
  refreshAdmin();
  redirect(`/admin/subjects/${subject.id}`);
}

export async function updateSubject(subjectId: string, form: FormData) {
  await prisma.subject.update({
    where: { id: subjectId },
    data: parseSubjectForm(form),
  });
  refreshAdmin();
  redirect(`/admin/subjects/${subjectId}`);
}

export async function deleteSubject(subjectId: string) {
  await prisma.$transaction([
    prisma.checkEvent.deleteMany({ where: { subjectId } }),
    prisma.householdDayStatus.deleteMany({ where: { subjectId } }),
    prisma.riskAssessment.deleteMany({ where: { subjectId } }),
    prisma.subject.delete({ where: { id: subjectId } }),
  ]);
  refreshAdmin();
  redirect("/admin");
}

export async function createWorker(form: FormData) {
  await prisma.worker.create({
    data: { ...parseWorkerForm(form), role: WorkerRole.WORKER },
  });
  refreshAdmin();
  redirect("/admin");
}

export async function updateWorker(workerId: string, form: FormData) {
  await prisma.worker.update({
    where: { id: workerId, role: WorkerRole.WORKER },
    data: parseWorkerForm(form),
  });
  refreshAdmin();
  redirect("/admin");
}

export async function deleteWorker(workerId: string) {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: { _count: { select: { subjects: true, checkEvents: true } } },
  });
  if (!worker || worker.role !== WorkerRole.WORKER) {
    throw new Error("생활지원사를 찾을 수 없습니다.");
  }
  if (worker._count.subjects > 0 || worker._count.checkEvents > 0) {
    throw new Error("담당 대상자나 점검 기록이 있는 생활지원사는 삭제할 수 없습니다.");
  }
  await prisma.worker.delete({ where: { id: workerId } });
  refreshAdmin();
  redirect("/admin");
}
