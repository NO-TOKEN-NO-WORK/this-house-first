BEGIN;

CREATE UNIQUE INDEX "AlertDay_date_isDemo_key" ON "AlertDay"("date", "isDemo");

DROP INDEX "AlertDay_date_key";

COMMIT;
