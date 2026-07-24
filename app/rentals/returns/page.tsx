import { RentalStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ReturnRentalsScreen } from "@/components/rentals/return-rentals-screen";
import { LogoutButton } from "@/components/logout-button";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session-server";

export default async function ReturnRentalsPage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/login");
  }

  const [rentals, settings] = await Promise.all([
    prisma.rental.findMany({
      where: { status: RentalStatus.ACTIVE },
      select: {
        id: true,
        dueAt: true,
        totalCost: true,
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
        items: {
          select: {
            equipment: {
              select: {
                id: true,
                name: true,
                category: true,
                dailyRate: true,
                weekendDailyRate: true,
              },
            },
          },
        },
      },
      orderBy: { dueAt: "asc" },
    }),
    prisma.settings.findUnique({
      where: { id: 1 },
      select: { gracePeriodMinutes: true },
    }),
  ]);

  const rows = rentals.map((rental) => ({
    id: rental.id,
    dueAt: rental.dueAt.toISOString(),
    totalCost: rental.totalCost.toFixed(2),
    customer: rental.customer,
    items: rental.items.map(({ equipment }) => ({
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      dailyRate: equipment.dailyRate.toFixed(2),
      weekendDailyRate: equipment.weekendDailyRate?.toFixed(2) ?? null,
    })),
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
            Returns
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Active rentals, oldest due date first.
          </p>
        </div>
        <LogoutButton />
      </header>

      <ReturnRentalsScreen
        rentals={rows}
        gracePeriodMinutes={settings?.gracePeriodMinutes ?? 20}
        initialNow={new Date().toISOString()}
      />
    </main>
  );
}
