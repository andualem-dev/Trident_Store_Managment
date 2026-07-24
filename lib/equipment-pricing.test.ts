import { describe, expect, it } from "vitest";

import {
  formatEquipmentRateLabel,
  isWeekendDay,
  rateForDate,
  rentalTotalForItem,
} from "@/lib/equipment-pricing";

describe("equipment pricing", () => {
  it("detects Fri–Sun as weekend", () => {
    expect(isWeekendDay(new Date("2026-07-24T12:00:00"))).toBe(true); // Fri
    expect(isWeekendDay(new Date("2026-07-25T12:00:00"))).toBe(true); // Sat
    expect(isWeekendDay(new Date("2026-07-26T12:00:00"))).toBe(true); // Sun
    expect(isWeekendDay(new Date("2026-07-27T12:00:00"))).toBe(false); // Mon
  });

  it("uses weekend rate on Fri–Sun when set", () => {
    const rates = { dailyRate: 100, weekendDailyRate: 150 };
    expect(rateForDate(rates, new Date("2026-07-27T12:00:00"))).toBe(100);
    expect(rateForDate(rates, new Date("2026-07-24T12:00:00"))).toBe(150);
  });

  it("totals mixed weekday and weekend days", () => {
    const rates = { dailyRate: 100, weekendDailyRate: 150 };
    const total = rentalTotalForItem(
      rates,
      new Date("2026-07-23T10:00:00"), // Thu
      3, // Thu, Fri, Sat
    );
    expect(total).toBe(400);
  });

  it("formats flat and weekend labels", () => {
    expect(formatEquipmentRateLabel({ dailyRate: 50 })).toBe("50.00 / day");
    expect(
      formatEquipmentRateLabel({ dailyRate: 50, weekendDailyRate: 75 }),
    ).toBe("50.00 / day (Fri–Sun: 75.00)");
  });
});
