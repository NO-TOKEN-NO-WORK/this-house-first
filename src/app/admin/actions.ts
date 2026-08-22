"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { WorkerRole } from "../../lib/domain";
import { parseSubjectForm, parseWorkerForm } from "../../lib/admin/management";

const SERIALIZABLE_TRANSACTION = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

function refreshAdmin() {
  revalidatePath("/admin");
}

function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

async function requireActiveWorker(tx: Prisma.TransactionClient, workerId: string) {
  const worker = await tx.worker.findFirst({
    where: { id: workerId, role: WorkerRole.WORKER, archivedAt: null },
    select: { id: true },
  });
  if (!worker) {
    throw new Error("활성 생활지원사를 찾을 수 없습니다. 담당자를 다시 선택해 주세요.");
  }
}

export async function createSubject(form: FormData) {
  const data = parseSubjectForm(form);
  const subject = await prisma.$transaction(async (tx) => {
    await requireActiveWorker(tx, data.workerId);
    return tx.subject.create({ data });
  }, SERIALIZABLE_TRANSACTION);
  refreshAdmin();
  redirect(`/admin/subjects/${subject.id}`);
}

export async function updateSubject(subjectId: string, form: FormData) {
  const data = parseSubjectForm(form);
  await prisma.$transaction(async (tx) => {
    await requireActiveWorker(tx, data.workerId);
    await tx.subject.update({
      where: { id: subjectId },
      data,
    });
  }, SERIALIZABLE_TRANSACTION);
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
  try {
    await prisma.$transaction(async (tx) => {
      const worker = await tx.worker.findFirst({
        where: { id: workerId, role: WorkerRole.WORKER, archivedAt: null },
      });
      if (!worker) {
        throw new Error("생활지원사를 찾을 수 없거나 이미 보관되었습니다.");
      }
      const activeSubjectCount = await tx.subject.count({
        where: { workerId, archivedAt: null },
      });
      if (activeSubjectCount > 0) {
        throw new Error("활성 대상자가 배정된 생활지원사는 보관할 수 없습니다. 먼저 담당자를 변경하거나 대상자를 보관해 주세요.");
      }
      await tx.worker.update({
        where: { id: workerId, archivedAt: null },
        data: { archivedAt: new Date() },
      });
    }, SERIALIZABLE_TRANSACTION);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new Error("생활지원사를 찾을 수 없거나 이미 보관되었습니다.");
    }
    throw error;
  }
  refreshAdmin();
  redirect("/admin");
}
