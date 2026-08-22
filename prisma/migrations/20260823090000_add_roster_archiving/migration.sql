ALTER TABLE "Worker" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Subject" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Worker_role_archivedAt_idx" ON "Worker"("role", "archivedAt");
CREATE INDEX "Subject_workerId_archivedAt_idx" ON "Subject"("workerId", "archivedAt");
