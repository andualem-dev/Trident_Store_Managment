"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { updateCustomer } from "@/app/customers/actions";
import type { CustomerSummary } from "@/lib/customers";

type Props = {
  customer: CustomerSummary;
  isAdmin: boolean;
  onUpdated: (customer: CustomerSummary) => void;
};

export function CustomerEditSection({ customer, isAdmin, onUpdated }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [isBlacklisted, setIsBlacklisted] = useState(customer.isBlacklisted);

  useEffect(() => {
    setName(customer.name);
    setPhone(customer.phone);
    setIsBlacklisted(customer.isBlacklisted);
  }, [customer.id, customer.name, customer.phone, customer.isBlacklisted]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("phone", phone.trim());
    if (isAdmin) {
      formData.set("isBlacklisted", isBlacklisted ? "true" : "false");
    }

    startTransition(async () => {
      const result = await updateCustomer(customer.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUpdated(result.customer);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 border-t border-zinc-200 pt-4"
    >
      <h3 className="text-sm font-semibold text-zinc-900">Customer details</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`edit-name-${customer.id}`} className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id={`edit-name-${customer.id}`}
            name="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`edit-phone-${customer.id}`} className="mb-1 block text-sm font-medium">
            Phone
          </label>
          <input
            id={`edit-phone-${customer.id}`}
            name="phone"
            type="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {isAdmin ? (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={isBlacklisted}
            onChange={(event) => setIsBlacklisted(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Blacklisted customer
        </label>
      ) : customer.isBlacklisted ? (
        <p className="text-sm font-medium text-red-700">Blacklisted</p>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
