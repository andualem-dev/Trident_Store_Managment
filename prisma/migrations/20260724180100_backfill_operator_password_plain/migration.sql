-- Backfill known default passwords for seeded operators (only where not set yet).
UPDATE "Operator" SET "passwordPlain" = 'admin123' WHERE "uniqueCode" = 'ADMIN' AND "passwordPlain" IS NULL;
UPDATE "Operator" SET "passwordPlain" = 'op1pass' WHERE "uniqueCode" = 'OP1' AND "passwordPlain" IS NULL;
UPDATE "Operator" SET "passwordPlain" = 'op2pass' WHERE "uniqueCode" = 'OP2' AND "passwordPlain" IS NULL;
