"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createCustomer } from "@/app/customers/actions";
import type { CustomerSummary } from "@/lib/customers";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (customer: CustomerSummary) => void;
};

export function CustomerQuickAddPanel({ open, onClose, onCreated }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createCustomer(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated?.(result.customer);
      form.reset();
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button
        type="button"
        aria-label="Close panel"
        className="flex-1 cursor-default"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Quick add customer</h2>
            <p className="text-sm text-zinc-600">Name and phone only — rest is optional.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-xl border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="qa-name" className="mb-1 block text-sm font-medium">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                id="qa-name"
                name="name"
                required
                autoFocus
                className="min-h-12 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base"
              />
            </div>
            <div>
              <label htmlFor="qa-phone" className="mb-1 block text-sm font-medium">
                Phone <span className="text-red-600">*</span>
              </label>
              <input
                id="qa-phone"
                name="phone"
                type="tel"
                required
                enterKeyHint="done"
                className="min-h-12 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base"
              />
              <p className="mt-1 text-xs text-zinc-600">
                Press Enter here to save with just name and phone.
              </p>
            </div>

            <details className="group rounded-xl border border-zinc-200 px-3">
              <summary className="flex min-h-12 cursor-pointer list-none items-center text-sm font-medium text-zinc-800 after:ml-auto after:text-lg after:text-zinc-600 after:content-['+'] group-open:after:content-['−']">
                ID card photo (optional)
              </summary>
              <div className="pb-3">
                <input
                  name="idCardPhoto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="block w-full text-sm text-zinc-600"
                />
              </div>
            </details>

            <details className="group rounded-xl border border-zinc-200 px-3">
              <summary className="flex min-h-12 cursor-pointer list-none items-center text-sm font-medium text-zinc-800 after:ml-auto after:text-lg after:text-zinc-600 after:content-['+'] group-open:after:content-['−']">
                Profile picture (optional)
              </summary>
              <div className="pb-3">
                <input
                  name="profilePhoto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="block w-full text-sm text-zinc-600"
                />
              </div>
            </details>

            <details className="group rounded-xl border border-zinc-200 px-3">
              <summary className="flex min-h-12 cursor-pointer list-none items-center text-sm font-medium text-zinc-800 after:ml-auto after:text-lg after:text-zinc-600 after:content-['+'] group-open:after:content-['−']">
                Guarantor (optional)
              </summary>
              <div className="space-y-3 pb-3">
                <div>
                  <label htmlFor="qa-g-name" className="mb-1 block text-sm font-medium">
                    Guarantor name
                  </label>
                  <input
                    id="qa-g-name"
                    name="guarantorName"
                    className="min-h-12 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="qa-g-phone" className="mb-1 block text-sm font-medium">
                    Guarantor phone
                  </label>
                  <input
                    id="qa-g-phone"
                    name="guarantorPhone"
                    type="tel"
                    className="min-h-12 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </details>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-auto flex gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-14 flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-14 flex-1 rounded-xl bg-zinc-900 px-4 text-base font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:text-zinc-950"
            >
              {pending ? "Saving…" : "Save customer"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
