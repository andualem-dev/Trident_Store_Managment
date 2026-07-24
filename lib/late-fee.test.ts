import assert from "node:assert/strict";
import test from "node:test";

import { calculateLateFee } from "./late-fee";

const dueAt = new Date("2026-07-23T14:00:00.000Z");
const base = {
  dueAt,
  gracePeriodMinutes: 20,
  dailyRateCents: 15_000,
};

test("on-time return has no late fee", () => {
  assert.deepEqual(
    calculateLateFee({
      ...base,
      returnedAt: new Date("2026-07-23T13:30:00.000Z"),
    }),
    { extraDays: 0, lateFeeCents: 0 },
  );
});

test("return at the grace-period boundary has no late fee", () => {
  assert.deepEqual(
    calculateLateFee({
      ...base,
      returnedAt: new Date("2026-07-23T14:20:00.000Z"),
    }),
    { extraDays: 0, lateFeeCents: 0 },
  );
});

test("return just past grace charges one extra day", () => {
  assert.deepEqual(
    calculateLateFee({
      ...base,
      returnedAt: new Date("2026-07-23T14:20:00.001Z"),
    }),
    { extraDays: 1, lateFeeCents: 15_000 },
  );
});

test("return two days late charges two extra days", () => {
  assert.deepEqual(
    calculateLateFee({
      ...base,
      returnedAt: new Date("2026-07-25T14:00:00.000Z"),
    }),
    { extraDays: 2, lateFeeCents: 30_000 },
  );
});
