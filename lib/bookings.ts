import { BookingStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseBookingDate(
  value: string,
  boundary: "start" | "end",
): Date | null {
  if (!DATE_ONLY.test(value)) {
    return null;
  }

  const suffix =
    boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function bookingOverlapWhere(
  equipmentId: string,
  startDate: Date,
  endDate: Date,
): Prisma.BookingWhereInput {
  return {
    equipmentId,
    status: { in: [BookingStatus.UPCOMING, BookingStatus.ACTIVE] },
    startDate: { lte: endDate },
    endDate: { gte: startDate },
  };
}

export function currentBookingBlockWhere(
  now: Date,
): Prisma.BookingWhereInput {
  return {
    status: { in: [BookingStatus.UPCOMING, BookingStatus.ACTIVE] },
    startDate: { lte: now },
    endDate: { gte: now },
  };
}

export async function syncStartedBookings(now = new Date()) {
  await prisma.booking.updateMany({
    where: {
      status: BookingStatus.UPCOMING,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    data: { status: BookingStatus.ACTIVE },
  });
}
