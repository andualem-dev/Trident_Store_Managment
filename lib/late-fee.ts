import { rateForDate, type EquipmentRates } from "@/lib/equipment-pricing";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export type LateFeeResult = {
  extraDays: number;
  lateFeeCents: number;
};

export function calculateLateFee(input: {
  dueAt: Date;
  returnedAt: Date;
  gracePeriodMinutes: number;
  dailyRateCents: number;
}): LateFeeResult {
  const dueTime = input.dueAt.getTime();
  const returnTime = input.returnedAt.getTime();

  if (!Number.isFinite(dueTime) || !Number.isFinite(returnTime)) {
    throw new Error("Invalid due or return date.");
  }
  if (
    !Number.isInteger(input.gracePeriodMinutes) ||
    input.gracePeriodMinutes < 0
  ) {
    throw new Error("Grace period must be a non-negative integer.");
  }
  if (
    !Number.isSafeInteger(input.dailyRateCents) ||
    input.dailyRateCents < 0
  ) {
    throw new Error("Daily rate must be a non-negative integer in cents.");
  }

  const graceDeadline =
    dueTime + input.gracePeriodMinutes * MINUTE_MS;
  if (returnTime <= graceDeadline) {
    return { extraDays: 0, lateFeeCents: 0 };
  }

  const extraDays = Math.ceil((returnTime - dueTime) / DAY_MS);
  return {
    extraDays,
    lateFeeCents: extraDays * input.dailyRateCents,
  };
}

export function calculateLateFeeForItems(input: {
  items: EquipmentRates[];
  dueAt: Date;
  returnedAt: Date;
  gracePeriodMinutes: number;
}): LateFeeResult {
  const dueTime = input.dueAt.getTime();
  const returnTime = input.returnedAt.getTime();

  if (!Number.isFinite(dueTime) || !Number.isFinite(returnTime)) {
    throw new Error("Invalid due or return date.");
  }
  if (
    !Number.isInteger(input.gracePeriodMinutes) ||
    input.gracePeriodMinutes < 0
  ) {
    throw new Error("Grace period must be a non-negative integer.");
  }

  const graceDeadline = dueTime + input.gracePeriodMinutes * MINUTE_MS;
  if (returnTime <= graceDeadline) {
    return { extraDays: 0, lateFeeCents: 0 };
  }

  const extraDays = Math.ceil((returnTime - dueTime) / DAY_MS);
  let lateFeeCents = 0;

  for (let day = 0; day < extraDays; day += 1) {
    const date = new Date(input.dueAt);
    date.setDate(date.getDate() + day);
    for (const item of input.items) {
      lateFeeCents += Math.round(rateForDate(item, date) * 100);
    }
  }

  return { extraDays, lateFeeCents };
}
