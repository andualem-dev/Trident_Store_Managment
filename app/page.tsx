import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { getSession } from "@/lib/session-server";

export default async function HomePage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-600">
            Trident Store
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Welcome, {session.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {session.isAdmin ? "Admin operator" : "Counter operator"}
          </p>
        </div>
        <LogoutButton />
      </header>

      <nav className="flex flex-col gap-2">
        <Link
          href="/rentals/new"
          className="inline-flex min-h-16 items-center justify-center rounded-xl bg-emerald-700 px-5 text-lg font-semibold text-white hover:bg-emerald-800"
        >
          New Rental
        </Link>
        <Link
          href="/rentals/returns"
          className="inline-flex min-h-16 items-center justify-center rounded-xl border-2 border-emerald-700 bg-white px-5 text-lg font-semibold text-emerald-800 hover:bg-emerald-50"
        >
          Return Equipment
        </Link>
        <Link
          href="/bookings/new"
          className="inline-flex min-h-14 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-base font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          New Booking
        </Link>
        <Link
          href="/bookings"
          className="inline-flex min-h-12 items-center rounded-xl border border-zinc-300 bg-white px-5 text-base font-medium text-zinc-900 hover:bg-zinc-50"
        >
          View Bookings
        </Link>
        <Link
          href="/customers"
          className="inline-flex min-h-12 items-center rounded-xl border border-zinc-300 bg-white px-5 text-base font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Customers
        </Link>
        {session.isAdmin ? (
          <Link
            href="/admin"
            className="inline-flex min-h-12 items-center rounded-xl border border-zinc-300 bg-white px-5 text-base font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Admin area
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
