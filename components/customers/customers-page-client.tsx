"use client";

import { useState } from "react";

import { CustomerPhoneSearch } from "@/components/customers/customer-phone-search";
import { CustomerQuickAddPanel } from "@/components/customers/customer-quick-add-panel";
import type { CustomerListRow, CustomerSummary } from "@/lib/customers";

export function CustomersPageClient({
  customers,
}: {
  customers: CustomerListRow[];
}) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(
    null,
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          {customers.length} registered customer{customers.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="inline-flex min-h-11 items-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Quick add customer
        </button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Search by phone</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Reusable lookup — tap a result to select (for rentals later).
        </p>
        <div className="mt-4 max-w-md">
          <CustomerPhoneSearch
            key={selectedCustomer?.id ?? "no-customer"}
            selectedCustomer={selectedCustomer}
            onSelect={setSelectedCustomer}
          />
        </div>
        {selectedCustomer ? (
          <p className="mt-3 text-sm text-zinc-700">
            Selected:{" "}
            <span className="font-medium">{selectedCustomer.name}</span> (
            {selectedCustomer.phone})
          </p>
        ) : null}
      </section>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-600">
                  No customers yet. Use quick add to register someone.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {customer.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{customer.phone}</td>
                  <td className="px-4 py-3">
                    {customer.isBlacklisted ? (
                      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800 ring-1 ring-red-200 ring-inset">
                        Blacklisted
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CustomerQuickAddPanel
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={(customer) => setSelectedCustomer(customer)}
      />
    </>
  );
}
