import { EquipmentStatus, Prisma, RentalStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { escapeTelegramHtml } from "@/lib/telegram";

type OverdueRental = {
  customer: { name: string };
  operator: { name: string };
  dueAt: Date;
  items: Array<{ equipment: { name: string } }>;
};

function utcDayRange(now: Date) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function utcMonthRange(now: Date) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return { start, end };
}

function amount(value: Prisma.Decimal | string | number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function reportDate(now: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(now);
}

export function formatOverdueDuration(dueAt: Date, now: Date) {
  const milliseconds = Math.max(0, now.getTime() - dueAt.getTime());
  const totalMinutes = Math.max(1, Math.floor(milliseconds / 60_000));

  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"} overdue`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return `${totalHours} hour${totalHours === 1 ? "" : "s"} overdue`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days} day${days === 1 ? "" : "s"}${
    hours > 0 ? ` ${hours} hour${hours === 1 ? "" : "s"}` : ""
  } overdue`;
}

function overdueLines(rentals: OverdueRental[], now: Date) {
  if (rentals.length === 0) {
    return ["None"];
  }

  return rentals.flatMap((rental) => {
    const itemNames =
      rental.items.map((item) => item.equipment.name).join(", ") ||
      "No equipment items";
    return [
      `• ${escapeTelegramHtml(rental.customer.name)} — ${escapeTelegramHtml(itemNames)} — ${formatOverdueDuration(rental.dueAt, now)}`,
      `  Operator: ${escapeTelegramHtml(rental.operator.name)}`,
    ];
  });
}

async function getOverdueRentals(
  dueAt: Prisma.DateTimeFilter,
): Promise<OverdueRental[]> {
  return prisma.rental.findMany({
    where: {
      status: RentalStatus.ACTIVE,
      dueAt,
    },
    select: {
      dueAt: true,
      customer: { select: { name: true } },
      operator: { select: { name: true } },
      items: {
        select: { equipment: { select: { name: true } } },
      },
    },
    orderBy: { dueAt: "asc" },
  });
}

type RankedCustomer = {
  customerId: string;
  name: string;
  rentals: number;
  revenue: Prisma.Decimal;
};

async function getMonthlyCustomerRankings(
  now: Date,
): Promise<RankedCustomer[]> {
  const month = utcMonthRange(now);
  const grouped = await prisma.rental.groupBy({
    by: ["customerId"],
    where: {
      startAt: { gte: month.start, lt: month.end },
    },
    _count: { _all: true },
    _sum: { totalCost: true, lateFee: true },
  });

  const names = new Map(
    (
      await prisma.customer.findMany({
        where: { id: { in: grouped.map((row) => row.customerId) } },
        select: { id: true, name: true },
      })
    ).map((customer) => [customer.id, customer.name]),
  );

  return grouped.map((row) => ({
    customerId: row.customerId,
    name: names.get(row.customerId) ?? "Unknown customer",
    rentals: row._count._all,
    revenue: new Prisma.Decimal(row._sum.totalCost ?? 0).add(
      row._sum.lateFee ?? 0,
    ),
  }));
}

function revenueRankingLines(rankings: RankedCustomer[], limit = 3) {
  return [...rankings]
    .sort((a, b) => b.revenue.comparedTo(a.revenue))
    .slice(0, limit)
    .map(
      (row, index) =>
        `${index + 1}. ${escapeTelegramHtml(row.name)} — ${row.rentals} rental${row.rentals === 1 ? "" : "s"} — ${amount(row.revenue)}`,
    );
}

function frequencyRankingLines(rankings: RankedCustomer[], limit = 3) {
  return [...rankings]
    .sort(
      (a, b) =>
        b.rentals - a.rentals || b.revenue.comparedTo(a.revenue),
    )
    .slice(0, limit)
    .map(
      (row, index) =>
        `${index + 1}. ${escapeTelegramHtml(row.name)} — ${row.rentals} rental${row.rentals === 1 ? "" : "s"} — ${amount(row.revenue)}`,
    );
}

export async function buildDailyReport(now = new Date()) {
  const day = utcDayRange(now);

  const [today, overdue, maintenance, rankings] = await Promise.all([
    prisma.rental.aggregate({
      where: {
        startAt: { gte: day.start, lt: day.end },
      },
      _count: { _all: true },
      _sum: { totalCost: true, lateFee: true },
    }),
    getOverdueRentals({ lt: now }),
    prisma.equipment.findMany({
      where: { status: EquipmentStatus.MAINTENANCE },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    getMonthlyCustomerRankings(now),
  ]);

  const revenue = new Prisma.Decimal(today._sum.totalCost ?? 0).add(
    today._sum.lateFee ?? 0,
  );
  const maintenanceLines =
    maintenance.length > 0
      ? maintenance.map(
          (item) => `• ${escapeTelegramHtml(item.name)}`,
        )
      : ["None"];
  const topLines = revenueRankingLines(rankings);

  return [
    "<b>Trident Store — Daily Report</b>",
    reportDate(now),
    "",
    "<b>Today</b>",
    `Rentals: ${today._count._all}`,
    `Revenue: ${amount(revenue)}`,
    "",
    `<b>Currently Overdue (${overdue.length})</b>`,
    ...overdueLines(overdue, now),
    "",
    `<b>Maintenance (${maintenance.length})</b>`,
    ...maintenanceLines,
    "",
    "<b>Top Customers This Month</b>",
    ...(topLines.length > 0 ? topLines : ["No rentals this month"]),
  ].join("\n");
}

export async function buildOverdueReport(now = new Date()) {
  const rentals = await getOverdueRentals({ lt: now });
  return [
    `<b>Currently Overdue (${rentals.length})</b>`,
    ...overdueLines(rentals, now),
  ].join("\n");
}

export async function buildTopCustomersReport(now = new Date()) {
  const rankings = await getMonthlyCustomerRankings(now);
  const byRevenue = revenueRankingLines(rankings);
  const byFrequency = frequencyRankingLines(rankings);

  return [
    "<b>Top Customers — This Month</b>",
    "",
    "<b>By Revenue</b>",
    ...(byRevenue.length > 0 ? byRevenue : ["No rentals this month"]),
    "",
    "<b>By Frequency</b>",
    ...(byFrequency.length > 0 ? byFrequency : ["No rentals this month"]),
  ].join("\n");
}

export async function buildNewlyOverdueAlert(
  now = new Date(),
  lookbackMinutes = 60,
) {
  const windowStart = new Date(now.getTime() - lookbackMinutes * 60_000);
  const rentals = await getOverdueRentals({ gte: windowStart, lt: now });

  if (rentals.length === 0) {
    return { count: 0, message: null };
  }

  return {
    count: rentals.length,
    message: [
      "<b>⚠️ Newly Overdue Rentals</b>",
      ...overdueLines(rentals, now),
    ].join("\n"),
  };
}
