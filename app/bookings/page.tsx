import { BookingStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BookingsList } from "@/components/bookings/bookings-list";
import { LogoutButton } from "@/components/logout-button";
import { syncStartedBookings } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session-server";

export default async function BookingsPage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/login");
  }

  const now = new Date();
  await syncStartedBookings(now);

  const rows = await prisma.booking.findMany({
    where: {
      status: { in: [BookingStatus.UPCOMING, BookingStatus.ACTIVE] },
      endDate: { gte: now },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      customer: { select: { name: true, phone: true } },
      equipment: { select: { name: true, category: true } },
      operator: { select: { name: true } },
    },
    orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
  });

  const bookings = rows.map((booking) => ({
    id: booking.id,
    startDate: booking.startDate.toISOString(),
    endDate: booking.endDate.toISOString(),
    status: booking.status,
    customer: booking.customer,
    equipment: booking.equipment,
    operatorName: booking.operator.name,
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            ← Counter
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">
            Bookings
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Current and upcoming equipment reservations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/bookings/new"
            className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            + New booking
          </Link>
          <LogoutButton />
        </div>
      </header>

      <BookingsList bookings={bookings} />
    </main>
  );
}
