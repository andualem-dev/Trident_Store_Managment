export type EquipmentRates = {
  dailyRate: number | string;
  weekendDailyRate?: number | string | null;
};

export function isWeekendDay(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 5 || day === 6;
}

export function rateForDate(rates: EquipmentRates, date: Date) {
  const base = Number(rates.dailyRate);
  if (!Number.isFinite(base)) {
    throw new Error("Invalid daily rate.");
  }

  if (rates.weekendDailyRate != null && rates.weekendDailyRate !== "") {
    const weekend = Number(rates.weekendDailyRate);
    if (!Number.isFinite(weekend)) {
      throw new Error("Invalid weekend rate.");
    }
    if (isWeekendDay(date)) {
      return weekend;
    }
  }

  return base;
}

export function rentalTotalForItem(
  rates: EquipmentRates,
  startAt: Date,
  days: number,
) {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error("Days must be a positive integer.");
  }

  let total = 0;
  for (let index = 0; index < days; index += 1) {
    const day = new Date(startAt);
    day.setDate(day.getDate() + index);
    total += rateForDate(rates, day);
  }

  return Math.round(total * 100) / 100;
}

export function rentalTotalForItems(
  items: EquipmentRates[],
  startAt: Date,
  days: number,
) {
  return Math.round(
    items.reduce(
      (sum, item) => sum + rentalTotalForItem(item, startAt, days),
      0,
    ) * 100,
  ) / 100;
}

export function formatEquipmentRateLabel(rates: EquipmentRates) {
  const base = Number(rates.dailyRate);
  const weekend =
    rates.weekendDailyRate != null && rates.weekendDailyRate !== ""
      ? Number(rates.weekendDailyRate)
      : null;

  if (weekend != null && Number.isFinite(weekend) && weekend !== base) {
    return `${base.toFixed(2)} / day (Fri–Sun: ${weekend.toFixed(2)})`;
  }

  return `${base.toFixed(2)} / day`;
}
