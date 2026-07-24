import { BookingStatus, EquipmentStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NewRentalScreen } from "@/components/rentals/new-rental-screen";
import { LogoutButton } from "@/components/logout-button";
import { syncStartedBookings } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session-server";

export default async function NewRentalPage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/login");
  }

  const now = new Date();
  await syncStartedBookings(now);

  const [rows, frequencyRows] = await Promise.all([
    prisma.equipment.findMany({
      where: { status: EquipmentStatus.AVAILABLE },
      select: {
        id: true,
        name: true,
        category: true,
        dailyRate: true,
        bookings: {
          where: {
            status: { in: [BookingStatus.UPCOMING, BookingStatus.ACTIVE] },
            endDate: { gte: now },
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
          orderBy: { startDate: "asc" },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.rentalItem.groupBy({
      by: ["equipmentId"],
      _count: { _all: true },
      orderBy: {
        _count: { equipmentId: "desc" },
      },
      take: 24,
    }),
  ]);

  const rentalCounts = new Map(
    frequencyRows.map((row) => [
      row.equipmentId,
      row._count._all,
    ]),
  );

  const equipment = rows.map((item) => ({
    ...item,
    dailyRate: item.dailyRate.toFixed(2),
    rentalCount: rentalCounts.get(item.id) ?? 0,
    bookings: item.bookings.map((booking) => ({
      id: booking.id,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
    })),
  }));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="no-print flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            ← Counter
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">
            New Rental
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Select customer, tap equipment, confirm.
          </p>
        </div>
        <LogoutButton />
      </header>

      <NewRentalScreen equipment={equipment} initialNow={now.toISOString()} />
    </main>
  );
}
