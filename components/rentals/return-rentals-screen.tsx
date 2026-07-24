"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { returnRental } from "@/app/rentals/returns/actions";
import { calculateLateFeeForItems } from "@/lib/late-fee";
import { formatEquipmentRateLabel } from "@/lib/equipment-pricing";

export type ActiveRentalRow = {
  id: string;
  dueAt: string;
  totalCost: string;
  customer: {
    name: string;
    phone: string;
  };
  items: Array<{
    id: string;
    name: string;
    category: string;
    dailyRate: string;
    weekendDailyRate: string | null;
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

function dueLabel(dueAt: string, now: number) {
  const difference = new Date(dueAt).getTime() - now;
  const absolute = Math.abs(difference);
  const overdue = difference < 0;

  if (absolute < 60_000) {
    return "Due now";
  }

  const minutes = Math.max(1, Math.floor(absolute / 60_000));
  let amount: number;
  let unit: string;

  if (minutes < 60) {
    amount = minutes;
    unit = "minute";
  } else if (minutes < 24 * 60) {
    amount = Math.floor(minutes / 60);
    unit = "hour";
  } else {
    amount = Math.floor(minutes / (24 * 60));
    unit = "day";
  }

  const duration = `${amount} ${unit}${amount === 1 ? "" : "s"}`;
  return overdue ? `Due ${duration} ago` : `Due in ${duration}`;
}

export function ReturnRentalsScreen({
  rentals,
  gracePeriodMinutes,
  initialNow,
}: {
  rentals: ActiveRentalRow[];
  gracePeriodMinutes: number;
  initialNow: string;
}) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date(initialNow).getTime());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredRentals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return rentals;
    }
    return rentals.filter(
      (rental) =>
        rental.customer.name.toLowerCase().includes(normalized) ||
        rental.customer.phone.toLowerCase().includes(normalized),
    );
  }, [rentals, query]);

  const selected =
    rentals.find((rental) => rental.id === selectedId) ?? null;
  const preview = useMemo(() => {
    if (!selected) {
      return null;
    }

    return calculateLateFeeForItems({
      items: selected.items.map((item) => ({
        dailyRate: item.dailyRate,
        weekendDailyRate: item.weekendDailyRate,
      })),
      dueAt: new Date(selected.dueAt),
      returnedAt: new Date(now),
      gracePeriodMinutes,
    });
  }, [selected, now, gracePeriodMinutes]);

  function handleReturn() {
    if (!selected) {
      return;
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await returnRental(selected.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSelectedId(null);
      setSuccess(
        `${result.returned.customerName} returned successfully. Grand total: ${result.returned.grandTotal}`,
      );
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">
              Active rentals
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {rentals.length} rental{rentals.length === 1 ? "" : "s"} awaiting
              return
            </p>
          </div>
          <span className="rounded-full bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800 ring-1 ring-red-200">
            Overdue first
          </span>
        </div>

        <label htmlFor="return-search" className="sr-only">
          Search by customer name or phone
        </label>
        <input
          id="return-search"
          type="search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search customer name or phone…"
          className="mt-4 min-h-14 w-full rounded-xl border border-zinc-300 px-4 text-lg outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900"
        />

        {success ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {success}
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          {filteredRentals.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 px-4 py-10 text-center text-zinc-600">
              {rentals.length === 0
                ? "No active rentals."
                : "No rentals match that customer."}
            </p>
          ) : (
            filteredRentals.map((rental) => {
              const overdue = new Date(rental.dueAt).getTime() < now;
              const selectedRow = rental.id === selectedId;
              return (
                <button
                  key={rental.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(rental.id);
                    setError(null);
                    setSuccess(null);
                    setNow(Date.now());
                  }}
                  className={`min-h-28 w-full rounded-xl border p-5 text-left transition ${
                    selectedRow
                      ? "border-zinc-900 bg-zinc-50 ring-2 ring-zinc-900"
                      : "border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-zinc-950">
                        {rental.customer.name}
                      </p>
                      <p className="text-sm text-zinc-600">
                        {rental.customer.phone}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                        overdue
                          ? "bg-red-50 text-red-800 ring-1 ring-red-200"
                          : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                      }`}
                    >
                      {dueLabel(rental.dueAt, now)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-700">
                    {rental.items.map((item) => item.name).join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Due {dateTime(rental.dueAt)}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </section>

      <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
        {selected && preview ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-600">
                  Confirm return
                </p>
                <h2 className="text-xl font-semibold text-zinc-950">
                  {selected.customer.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setError(null);
                }}
                className="min-h-12 rounded-xl border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Items
              </p>
              <ul className="mt-2 divide-y divide-zinc-100">
                {selected.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between gap-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">{item.name}</p>
                      <p className="text-xs text-zinc-600">{item.category}</p>
                    </div>
                    <span className="tabular-nums text-zinc-700">
                      {formatEquipmentRateLabel({
                        dailyRate: item.dailyRate,
                        weekendDailyRate: item.weekendDailyRate,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <dl className="mt-5 space-y-3 border-t border-zinc-200 pt-4">
              <div className="flex justify-between gap-3 text-sm">
                <dt className="text-zinc-600">Original total</dt>
                <dd className="font-medium tabular-nums text-zinc-900">
                  {money(selected.totalCost)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <dt className="text-zinc-600">
                  Late fee
                  {preview.extraDays > 0
                    ? ` (${preview.extraDays} extra day${preview.extraDays === 1 ? "" : "s"})`
                    : ""}
                </dt>
                <dd
                  className={`font-medium tabular-nums ${
                    preview.lateFeeCents > 0
                      ? "text-red-700"
                      : "text-zinc-900"
                  }`}
                >
                  {money(preview.lateFeeCents / 100)}
                </dd>
              </div>
              <div className="flex items-end justify-between gap-3 border-t-2 border-zinc-900 pt-4">
                <dt className="text-lg font-semibold text-zinc-900">
                  Grand total
                </dt>
                <dd className="text-3xl font-bold tabular-nums text-zinc-950">
                  {money(
                    Number(selected.totalCost) +
                      preview.lateFeeCents / 100,
                  )}
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-xs text-zinc-600">
              Grace period: {gracePeriodMinutes} minutes. The exact fee is
              recalculated when you confirm.
            </p>

            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={pending}
              onClick={handleReturn}
              className="mt-5 min-h-16 w-full rounded-xl bg-emerald-700 px-4 text-lg font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-700"
            >
              {pending
                ? "Processing return…"
                : `Return now — ${money(
                    Number(selected.totalCost) +
                      preview.lateFeeCents / 100,
                  )}`}
            </button>
          </>
        ) : (
          <div className="py-12 text-center">
            <h2 className="font-semibold text-zinc-900">Select a rental</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Tap an active rental to review fees and return its items.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
