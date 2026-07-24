"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createRental,
  type RentalReceipt,
} from "@/app/rentals/new/actions";
import { CustomerPhoneSearch } from "@/components/customers/customer-phone-search";
import { CustomerAvatar } from "@/components/customers/customer-avatar";
import { CustomerQuickAddPanel } from "@/components/customers/customer-quick-add-panel";
import type { CustomerSummary } from "@/lib/customers";
import {
  formatEquipmentRateLabel,
  rentalTotalForItem,
  rentalTotalForItems,
} from "@/lib/equipment-pricing";

export type AvailableEquipment = {
  id: string;
  name: string;
  category: string;
  dailyRate: string;
  weekendDailyRate: string | null;
  rentalCount: number;
  bookings: Array<{
    id: string;
    startDate: string;
    endDate: string;
  }>;
};

function money(value: number | string) {
  return Number(value).toFixed(2);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function bookingDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function RentalReceiptView({
  receipt,
  onNewRental,
}: {
  receipt: RentalReceipt;
  onNewRental: () => void;
}) {
  return (
    <section className="print-receipt mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="no-print mb-6 flex flex-wrap justify-between gap-3">
        <button
          type="button"
          onClick={onNewRental}
          className="min-h-11 rounded-xl border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50"
        >
          Start another rental
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Print receipt
        </button>
      </div>

      <div className="border-b border-zinc-200 pb-5 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-600">
          Trident Store
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
          Rental Receipt
        </h2>
        <p className="mt-1 text-xs text-zinc-600">#{receipt.rentalId}</p>
      </div>

      <dl className="grid gap-4 border-b border-zinc-200 py-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-600">
            Customer
          </dt>
          <dd className="mt-1 font-semibold text-zinc-900">
            {receipt.customer.name}
          </dd>
          <dd className="text-sm text-zinc-600">{receipt.customer.phone}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-600">
            Operator
          </dt>
          <dd className="mt-1 font-semibold text-zinc-900">
            {receipt.operatorName}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-600">
            Start
          </dt>
          <dd className="mt-1 text-sm text-zinc-900">
            {dateTime(receipt.startAt)}
          </dd>
        </div>
        <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
          <dt className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Due date and time
          </dt>
          <dd className="mt-1 font-bold text-amber-950">
            {dateTime(receipt.dueAt)}
          </dd>
        </div>
      </dl>

      <div className="py-5">
        <h3 className="text-sm font-semibold text-zinc-900">
          Equipment ({receipt.days} day{receipt.days === 1 ? "" : "s"})
        </h3>
        <ul className="mt-3 divide-y divide-zinc-100">
          {receipt.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div>
                <p className="font-medium text-zinc-900">{item.name}</p>
                <p className="text-xs text-zinc-600">{item.category}</p>
              </div>
              <p className="text-sm tabular-nums text-zinc-700">
                {formatEquipmentRateLabel({
                  dailyRate: item.dailyRate,
                  weekendDailyRate: item.weekendDailyRate,
                })}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-end justify-between border-t-2 border-zinc-900 pt-4">
        <span className="text-lg font-semibold text-zinc-900">Total</span>
        <span className="text-3xl font-bold tabular-nums text-zinc-950">
          {money(receipt.totalCost)}
        </span>
      </div>
    </section>
  );
}

export function NewRentalScreen({
  equipment,
  initialNow,
}: {
  equipment: AvailableEquipment[];
  initialNow: string;
}) {
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [days, setDays] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<RentalReceipt | null>(null);
  const now = new Date(initialNow).getTime();

  function isBookedToday(item: AvailableEquipment) {
    return item.bookings.some(
      (booking) =>
        new Date(booking.startDate).getTime() <= now &&
        new Date(booking.endDate).getTime() >= now,
    );
  }

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(
    () => equipment.filter((item) => selectedSet.has(item.id)),
    [equipment, selectedSet],
  );
  const total = useMemo(() => {
    const startAt = new Date(initialNow);
    return rentalTotalForItems(
      selectedItems.map((item) => ({
        dailyRate: item.dailyRate,
        weekendDailyRate: item.weekendDailyRate,
      })),
      startAt,
      days,
    );
  }, [selectedItems, days, initialNow]);
  const filteredGroups = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const groups = new Map<string, AvailableEquipment[]>();

    for (const item of equipment) {
      if (
        query &&
        !item.name.toLowerCase().includes(query) &&
        !item.category.toLowerCase().includes(query)
      ) {
        continue;
      }
      const group = groups.get(item.category) ?? [];
      group.push(item);
      groups.set(item.category, group);
    }

    return [...groups.entries()];
  }, [equipment, filter]);
  const frequentlyRented = useMemo(
    () =>
      [...equipment]
        .filter(
          (item) =>
            item.rentalCount > 0 &&
            !item.bookings.some(
              (booking) =>
                new Date(booking.startDate).getTime() <= now &&
                new Date(booking.endDate).getTime() >= now,
            ),
        )
        .sort(
          (a, b) =>
            b.rentalCount - a.rentalCount ||
            a.name.localeCompare(b.name),
        )
        .slice(0, 6),
    [equipment, now],
  );

  if (receipt) {
    return (
      <RentalReceiptView
        receipt={receipt}
        onNewRental={() => {
          setReceipt(null);
          setCustomer(null);
          setSelectedIds([]);
          setDays(1);
          setFilter("");
          setError(null);
        }}
      />
    );
  }

  function toggleEquipment(id: string) {
    const item = equipment.find((candidate) => candidate.id === id);
    if (!item || isBookedToday(item)) {
      return;
    }
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    );
  }

  function handleConfirm() {
    if (!customer) {
      setError("Select a customer.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Select at least one equipment item.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createRental({
        customerId: customer.id,
        equipmentIds: selectedIds,
        days,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setReceipt(result.receipt);
    });
  }

  return (
    <>
      <div className="no-print grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-950">
                1. Customer
              </h2>
              <button
                type="button"
                onClick={() => setQuickAddOpen(true)}
                className="min-h-12 rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                + Quick add
              </button>
            </div>

            {customer ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                <div className="flex items-center gap-3">
                  <CustomerAvatar
                    name={customer.name}
                    profilePhotoUrl={customer.profilePhotoUrl}
                    size="md"
                  />
                  <div>
                    <p className="font-semibold text-emerald-950">{customer.name}</p>
                    <p className="text-sm text-emerald-800">{customer.phone}</p>
                    {customer.isBlacklisted ? (
                      <p className="mt-1 font-semibold text-red-700">
                        Warning: customer is blacklisted
                      </p>
                    ) : null}
                  </div>
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
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">
                  2. Equipment
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Available inventory is selectable. Today&apos;s bookings are
                  shown but blocked.
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
                {equipment.filter((item) => !isBookedToday(item)).length} available
              </span>
            </div>

            {frequentlyRented.length > 0 ? (
              <div className="mt-5 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
                  Frequently rented
                </h3>
                <p className="mt-1 text-xs text-zinc-600">
                  Quick access to the most-used available items.
                </p>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {frequentlyRented.map((item) => {
                    const selected = selectedSet.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleEquipment(item.id)}
                        className={`min-h-20 min-w-44 shrink-0 rounded-xl border p-3 text-left ${
                          selected
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
                        }`}
                      >
                        <span className="block font-semibold">{item.name}</span>
                        <span
                          className={`mt-1 block text-sm ${
                            selected ? "text-white/80" : "text-zinc-600"
                          }`}
                        >
                          {formatEquipmentRateLabel({
                            dailyRate: item.dailyRate,
                            weekendDailyRate: item.weekendDailyRate,
                          })}
                        </span>
                        {item.bookings.map((booking) => (
                          <span
                            key={booking.id}
                            className={`mt-2 block text-xs font-medium ${
                              selected ? "text-white/80" : "text-amber-900"
                            }`}
                          >
                            Booked {bookingDate(booking.startDate)} –{" "}
                            {bookingDate(booking.endDate)}
                          </span>
                        ))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter equipment by name…"
              className="mt-4 min-h-14 w-full rounded-xl border border-zinc-300 px-4 text-lg outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900"
            />

            <div className="mt-5 space-y-6">
              {filteredGroups.length === 0 ? (
                <p className="rounded-xl bg-zinc-50 px-4 py-8 text-center text-zinc-600">
                  No available equipment matches.
                </p>
              ) : (
                filteredGroups.map(([category, items]) => (
                  <div key={category}>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-600">
                      {category}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((item) => {
                        const selected = selectedSet.has(item.id);
                        const bookedToday = isBookedToday(item);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-pressed={selected}
                            disabled={bookedToday}
                            onClick={() => toggleEquipment(item.id)}
                            className={`min-h-24 rounded-xl border p-4 text-left transition ${
                              selected
                                ? "border-zinc-900 bg-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-2"
                                : bookedToday
                                  ? "cursor-not-allowed border-amber-200 bg-amber-50 text-zinc-700"
                                : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50"
                            }`}
                          >
                            <span className="block font-semibold">
                              {item.name}
                            </span>
                            <span
                              className={`mt-1 block text-sm ${
                                selected ? "text-white/80" : "text-zinc-600"
                              }`}
                            >
                              {formatEquipmentRateLabel({
                            dailyRate: item.dailyRate,
                            weekendDailyRate: item.weekendDailyRate,
                          })}
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
                                Booked {bookingDate(booking.startDate)} –{" "}
                                {bookingDate(booking.endDate)}
                              </span>
                            ))}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-lg font-semibold text-zinc-950">Rental cart</h2>

          <label
            htmlFor="rental-days"
            className="mt-4 block text-sm font-medium text-zinc-700"
          >
            Duration
          </label>
          <select
            id="rental-days"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="mt-1 min-h-14 w-full rounded-xl border border-zinc-300 bg-white px-3 text-lg font-medium"
          >
            {Array.from({ length: 14 }, (_, index) => index + 1).map(
              (value) => (
                <option key={value} value={value}>
                  {value} day{value === 1 ? "" : "s"}
                </option>
              ),
            )}
          </select>

          <div className="mt-5 min-h-28">
            {selectedItems.length === 0 ? (
              <p className="rounded-xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
                Tap equipment to add it.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {selectedItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-zinc-600">
                        {money(
                          rentalTotalForItem(
                            {
                              dailyRate: item.dailyRate,
                              weekendDailyRate: item.weekendDailyRate,
                            },
                            new Date(initialNow),
                            days,
                          ),
                        )}{" "}
                        for {days} day{days === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleEquipment(item.id)}
                      className="min-h-12 shrink-0 rounded-xl px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 flex items-end justify-between border-t-2 border-zinc-900 pt-4">
            <span className="font-semibold text-zinc-900">Total</span>
            <span className="text-3xl font-bold tabular-nums text-zinc-950">
              {money(total)}
            </span>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={pending || !customer || selectedIds.length === 0}
            onClick={handleConfirm}
            className="mt-5 min-h-16 w-full rounded-xl bg-emerald-700 px-4 text-lg font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-700"
          >
            {pending ? "Creating rental…" : "Confirm rental"}
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
