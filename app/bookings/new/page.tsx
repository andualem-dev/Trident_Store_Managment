import { BookingStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NewBookingScreen } from "@/components/bookings/new-booking-screen";
import { LogoutButton } from "@/components/logout-button";
import { syncStartedBookings } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session-server";

export default async function NewBookingPage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/login");
  }

  const now = new Date();
  await syncStartedBookings(now);

  const rows = await prisma.equipment.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      dailyRate: true,
      weekendDailyRate: true,
      status: true,
      bookings: {
        where: {
          status: { in: [BookingStatus.UPCOMING, BookingStatus.ACTIVE] },
          endDate: { gte: now },
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          status: true,
        },
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const equipment = rows.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    dailyRate: item.dailyRate.toFixed(2),
    weekendDailyRate: item.weekendDailyRate?.toFixed(2) ?? null,
    status: item.status,
    bookings: item.bookings.map((booking) => ({
      id: booking.id,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      status: booking.status,
    })),
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/bookings"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            ← Bookings
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">
            New Booking
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Reserve one equipment item for an inclusive date range.
          </p>
        </div>
        <LogoutButton />
      </header>

      <NewBookingScreen equipment={equipment} />
    </main>
  );
}
