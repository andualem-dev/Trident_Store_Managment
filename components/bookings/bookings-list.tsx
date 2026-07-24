"use client";

import type { BookingStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cancelBooking } from "@/app/bookings/actions";

export type BookingListRow = {
  id: string;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  customer: {
    name: string;
    phone: string;
  };
  equipment: {
    name: string;
    category: string;
  };
  operatorName: string;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function BookingsList({
  bookings,
}: {
  bookings: BookingListRow[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleCancel(booking: BookingListRow) {
    setError(null);
    setPendingId(booking.id);
    startTransition(async () => {
      const result = await cancelBooking(booking.id);
      if (!result.ok) {
        setError(result.error);
        setPendingId(null);
        router.refresh();
        return;
      }
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-950">
          Active and upcoming
        </h2>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
          {bookings.length}
        </span>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Equipment</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Booked by</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-600">
                  No current or upcoming bookings.
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-zinc-900">
                      {booking.equipment.name}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {booking.equipment.category}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-zinc-900">
                      {booking.customer.name}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {booking.customer.phone}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-zinc-700">
                    {displayDate(booking.startDate)} –{" "}
                    {displayDate(booking.endDate)}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        booking.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                          : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                      }`}
                    >
                      {booking.status === "ACTIVE" ? "Active" : "Upcoming"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {booking.operatorName}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      disabled={pendingId === booking.id}
                      onClick={() => handleCancel(booking)}
                      className="min-h-10 rounded-lg border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-zinc-500"
                    >
                      {pendingId === booking.id ? "Cancelling…" : "Cancel"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
