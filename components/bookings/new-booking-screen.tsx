"use client";

import type { BookingStatus, EquipmentStatus } from "@prisma/client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { createBooking } from "@/app/bookings/actions";
import { CustomerPhoneSearch } from "@/components/customers/customer-phone-search";
import { CustomerQuickAddPanel } from "@/components/customers/customer-quick-add-panel";
import type { CustomerSummary } from "@/lib/customers";

type EquipmentBooking = {
  id: string;
  startDate: string;
  endDate: string;
  status: BookingStatus;
};

export type BookingEquipment = {
  id: string;
  name: string;
  category: string;
  dailyRate: string;
  status: EquipmentStatus;
  bookings: EquipmentBooking[];
};

function localDateInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function overlaps(
  booking: EquipmentBooking,
  startDate: string,
  endDate: string,
) {
  if (!startDate || !endDate) {
    return false;
  }
  const existingStart = booking.startDate.slice(0, 10);
  const existingEnd = booking.endDate.slice(0, 10);
  return existingStart <= endDate && existingEnd >= startDate;
}

export function NewBookingScreen({
  equipment,
}: {
  equipment: BookingEquipment[];
}) {
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const today = localDateInputValue();

  const groups = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const grouped = new Map<string, BookingEquipment[]>();
    for (const item of equipment) {
      if (
        query &&
        !item.name.toLowerCase().includes(query) &&
        !item.category.toLowerCase().includes(query)
      ) {
        continue;
      }
      const group = grouped.get(item.category) ?? [];
      group.push(item);
      grouped.set(item.category, group);
    }
    return [...grouped.entries()];
  }, [equipment, filter]);

  const selectedEquipment =
    equipment.find((item) => item.id === equipmentId) ?? null;
  const selectedConflict =
    selectedEquipment?.bookings.some((booking) =>
      overlaps(booking, startDate, endDate),
    ) ?? false;

  function handleConfirm() {
    if (!customer) {
      setError("Select a customer.");
      return;
    }
    if (!equipmentId) {
      setError("Select one equipment item.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Choose a start and end date.");
      return;
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await createBooking({
        customerId: customer.id,
        equipmentId,
        startDate,
        endDate,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(
        `Booked ${result.booking?.equipmentName} for ${result.booking?.customerName}.`,
      );
      setEquipmentId(null);
      setStartDate("");
      setEndDate("");
    });
  }

  return (
    <>
      {success ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          <span>{success}</span>
          <Link href="/bookings" className="underline">
            View bookings
          </Link>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-950">
                1. Customer
              </h2>
              <button
                type="button"
                onClick={() => setQuickAddOpen(true)}
                className="min-h-12 rounded-xl border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50"
              >
                + Quick add
              </button>
            </div>

            {customer ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                <div>
                  <p className="font-semibold text-emerald-950">
                    {customer.name}
                  </p>
                  <p className="text-sm text-emerald-800">{customer.phone}</p>
                  {customer.isBlacklisted ? (
                    <p className="mt-1 font-semibold text-red-700">
                      Warning: customer is blacklisted
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setCustomer(null)}
                  className="min-h-12 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-900"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <CustomerPhoneSearch
                  autoFocus
                  onSelect={(selection) => {
                    setCustomer(selection);
                    setError(null);
                  }}
                  label="Search customer by name"
                  placeholder="Type customer name…"
                />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">
              2. Date range
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="booking-start"
                  className="mb-1 block text-sm font-medium text-zinc-700"
                >
                  Start date
                </label>
                <input
                  id="booking-start"
                  type="date"
                  min={today}
                  value={startDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    setStartDate(value);
                    if (endDate && endDate < value) {
                      setEndDate(value);
                    }
                  }}
                  className="min-h-14 w-full rounded-xl border border-zinc-300 px-3 text-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="booking-end"
                  className="mb-1 block text-sm font-medium text-zinc-700"
                >
                  End date
                </label>
                <input
                  id="booking-end"
                  type="date"
                  min={startDate || today}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="min-h-14 w-full rounded-xl border border-zinc-300 px-3 text-lg"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">
                3. Equipment
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                All equipment is shown; current status does not prevent a future
                booking.
              </p>
            </div>

            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter equipment by name…"
              className="mt-4 min-h-14 w-full rounded-xl border border-zinc-300 px-4 text-lg outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900"
            />

            <div className="mt-5 space-y-6">
              {groups.map(([category, items]) => (
                <div key={category}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-600">
                    {category}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => {
                      const selected = item.id === equipmentId;
                      const rangeConflict = item.bookings.some((booking) =>
                        overlaps(booking, startDate, endDate),
                      );
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setEquipmentId(item.id);
                            setError(null);
                          }}
                          className={`min-h-24 rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-zinc-900 bg-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-2"
                              : rangeConflict
                                ? "border-red-200 bg-red-50 hover:border-red-400"
                                : "border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50"
                          }`}
                        >
                          <span className="block font-semibold">{item.name}</span>
                          <span
                            className={`mt-1 block text-xs ${
                              selected ? "text-white/80" : "text-zinc-600"
                            }`}
                          >
                            Today: {item.status.toLowerCase()}
                          </span>
                          {item.bookings.map((booking) => (
                            <span
                              key={booking.id}
                              className={`mt-2 block rounded-md px-2 py-1 text-xs font-medium ${
                                selected
                                  ? "bg-white/15 text-white"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              Booked {displayDate(booking.startDate)} –{" "}
                              {displayDate(booking.endDate)}
                            </span>
                          ))}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-lg font-semibold text-zinc-950">
            Booking summary
          </h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-zinc-600">Customer</dt>
              <dd className="mt-1 font-semibold text-zinc-900">
                {customer?.name ?? "Not selected"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Equipment</dt>
              <dd className="mt-1 font-semibold text-zinc-900">
                {selectedEquipment?.name ?? "Not selected"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Dates</dt>
              <dd className="mt-1 font-semibold text-zinc-900">
                {startDate && endDate
                  ? `${displayDate(`${startDate}T00:00:00.000Z`)} – ${displayDate(`${endDate}T23:59:59.999Z`)}`
                  : "Not selected"}
              </dd>
            </div>
          </dl>

          {selectedConflict ? (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              This item already has an overlapping booking. Choose another item
              or date range.
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={
              pending ||
              !customer ||
              !equipmentId ||
              !startDate ||
              !endDate ||
              selectedConflict
            }
            onClick={handleConfirm}
            className="mt-5 min-h-16 w-full rounded-xl bg-emerald-700 px-4 text-lg font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-700"
          >
            {pending ? "Creating booking…" : "Confirm booking"}
          </button>
        </aside>
      </div>

      <CustomerQuickAddPanel
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={(newCustomer) => {
          setCustomer(newCustomer);
          setError(null);
        }}
      />
    </>
  );
}
