"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { linkGuarantor, removeGuarantor } from "@/app/customers/actions";
import { CustomerPhoneSearch } from "@/components/customers/customer-phone-search";
import type { CustomerGuarantor, CustomerSummary } from "@/lib/customers";

type Props = {
  customer: CustomerSummary;
  onUpdated: (customer: CustomerSummary) => void;
};

export function CustomerGuarantorsSection({ customer, onUpdated }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guarantorPick, setGuarantorPick] = useState<CustomerSummary | null>(null);

  const guarantors = customer.guarantors ?? [];

  function applyGuarantors(nextGuarantors: CustomerGuarantor[]) {
    onUpdated({ ...customer, guarantors: nextGuarantors });
    router.refresh();
  }

  function handleLink() {
    if (!guarantorPick) {
      setError("Search and select an existing customer as guarantor.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await linkGuarantor(customer.id, guarantorPick.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyGuarantors(result.guarantors);
      setGuarantorPick(null);
    });
  }

  function handleRemove(guarantorId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeGuarantor(customer.id, guarantorId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyGuarantors(result.guarantors);
    });
  }

  return (
    <div className="space-y-3 border-t border-zinc-200 pt-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Guarantors</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Link an existing registered customer as guarantor.
        </p>
      </div>

      {guarantors.length > 0 ? (
        <ul className="space-y-2">
          {guarantors.map((guarantor) => (
            <li
              key={guarantor.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2"
            >
              <div>
                <p className="font-medium text-zinc-900">{guarantor.name}</p>
                <p className="text-sm text-zinc-600">{guarantor.phone}</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleRemove(guarantor.id)}
                className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-600">No guarantor linked yet.</p>
      )}

      <div className="space-y-2">
        <CustomerPhoneSearch
          key={`guarantor-${customer.id}-${guarantorPick?.id ?? "none"}`}
          label="Add guarantor from existing customers"
          placeholder="Search customer to link as guarantor…"
          selectedCustomer={guarantorPick}
          excludeCustomerId={customer.id}
          onSelect={setGuarantorPick}
        />
        <button
          type="button"
          disabled={pending || !guarantorPick}
          onClick={handleLink}
          className="min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {pending ? "Linking…" : "Link guarantor"}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
