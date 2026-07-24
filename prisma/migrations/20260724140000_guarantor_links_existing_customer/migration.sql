-- Link guarantors to existing customers instead of free-text name/phone.

DELETE FROM "Guarantor";

ALTER TABLE "Guarantor" DROP COLUMN "name";
ALTER TABLE "Guarantor" DROP COLUMN "phone";

ALTER TABLE "Guarantor" ADD COLUMN "guarantorCustomerId" TEXT NOT NULL;

ALTER TABLE "Guarantor" ADD CONSTRAINT "Guarantor_guarantorCustomerId_fkey"
  FOREIGN KEY ("guarantorCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Guarantor_customerId_guarantorCustomerId_key"
  ON "Guarantor"("customerId", "guarantorCustomerId");
