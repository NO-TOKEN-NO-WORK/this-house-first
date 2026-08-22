-- CreateTable
CREATE TABLE "SubjectBriefing" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sourceCheckEventId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectBriefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubjectBriefing_subjectId_key" ON "SubjectBriefing"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectBriefing_sourceCheckEventId_idx" ON "SubjectBriefing"("sourceCheckEventId");

-- AddForeignKey
ALTER TABLE "SubjectBriefing" ADD CONSTRAINT "SubjectBriefing_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
