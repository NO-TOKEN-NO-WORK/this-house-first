"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/db";
import { WorkerRole } from "../../lib/domain";
import { parseSubjectForm, parseWorkerForm } from "../../lib/admin/management";

function refreshAdmin() {
  revalidatePath("/admin");
}

function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
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

export async function archiveSubject(subjectId: string) {
  try {
    await prisma.subject.update({
      where: { id: subjectId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new Error("대상자를 찾을 수 없거나 이미 보관되었습니다.");
    }
    throw error;
  }
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

export async function archiveWorker(workerId: string) {
  const worker = await prisma.worker.findFirst({
    where: { id: workerId, role: WorkerRole.WORKER, archivedAt: null },
  });
  if (!worker) {
    throw new Error("생활지원사를 찾을 수 없거나 이미 보관되었습니다.");
  }
  const activeSubjectCount = await prisma.subject.count({
    where: { workerId, archivedAt: null },
  });
  if (activeSubjectCount > 0) {
    throw new Error("활성 대상자가 배정된 생활지원사는 보관할 수 없습니다. 먼저 담당자를 변경하거나 대상자를 보관해 주세요.");
  }
  try {
    await prisma.worker.update({
      where: { id: workerId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new Error("생활지원사를 찾을 수 없거나 이미 보관되었습니다.");
    }
    throw error;
  }
  refreshAdmin();
  redirect("/admin");
}
