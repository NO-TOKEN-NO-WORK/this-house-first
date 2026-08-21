-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'WORKER',

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "roadAddress" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "builtYear" INTEGER,
    "isDetached" BOOLEAN NOT NULL DEFAULT false,
    "structure" TEXT,
    "hasTopFloorUnit" BOOLEAN NOT NULL DEFAULT false,
    "mgmBldrgstPk" TEXT,
    "mainPurpose" TEXT,
    "roof" TEXT,
    "groundFloors" INTEGER,
    "bjdongCode" TEXT,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "phone" TEXT,
    "livesAlone" BOOLEAN NOT NULL DEFAULT false,
    "hasMobilityIssue" BOOLEAN,
    "hasChronicDisease" BOOLEAN,
    "hasAircon" BOOLEAN,
    "airconBroken" BOOLEAN NOT NULL DEFAULT false,
    "buildingId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDay" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "feelsLikeMax" DOUBLE PRECISION NOT NULL,
    "regionCode" TEXT,

    CONSTRAINT "AlertDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "alertDayId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "grade" INTEGER NOT NULL,
    "reasons" TEXT NOT NULL,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdDayStatus" (
    "id" TEXT NOT NULL,
    "alertDayId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNCHECKED',
    "callAttempts" INTEGER NOT NULL DEFAULT 0,
    "promotedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdDayStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckEvent" (
    "id" TEXT NOT NULL,
    "alertDayId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Building_mgmBldrgstPk_key" ON "Building"("mgmBldrgstPk");

-- CreateIndex
CREATE UNIQUE INDEX "AlertDay_date_key" ON "AlertDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_alertDayId_subjectId_key" ON "RiskAssessment"("alertDayId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdDayStatus_alertDayId_subjectId_key" ON "HouseholdDayStatus"("alertDayId", "subjectId");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_alertDayId_fkey" FOREIGN KEY ("alertDayId") REFERENCES "AlertDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdDayStatus" ADD CONSTRAINT "HouseholdDayStatus_alertDayId_fkey" FOREIGN KEY ("alertDayId") REFERENCES "AlertDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdDayStatus" ADD CONSTRAINT "HouseholdDayStatus_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckEvent" ADD CONSTRAINT "CheckEvent_alertDayId_fkey" FOREIGN KEY ("alertDayId") REFERENCES "AlertDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckEvent" ADD CONSTRAINT "CheckEvent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckEvent" ADD CONSTRAINT "CheckEvent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
