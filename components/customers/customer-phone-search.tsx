"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CustomerAvatar } from "@/components/customers/customer-avatar";
import type { CustomerSummary } from "@/lib/customers";

type SearchResponse = {
  customers: CustomerSummary[];
};

export type CustomerPhoneSearchProps = {
  onSelect: (customer: CustomerSummary) => void;
  selectedCustomer?: CustomerSummary | null;
  excludeCustomerId?: string;
  placeholder?: string;
  label?: string;
  minChars?: number;
  autoFocus?: boolean;
};

export function CustomerPhoneSearch({
  onSelect,
  selectedCustomer = null,
  excludeCustomerId,
  placeholder = "Search by name or phone…",
  label = "Search customer",
  minChars = 2,
  autoFocus = false,
}: CustomerPhoneSearchProps) {
  const listId = useId();
  const [query, setQuery] = useState(selectedCustomer?.name ?? "");
  const [results, setResults] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minChars) {
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/customers/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setResults([]);
          return;
        }
        const data = (await response.json()) as SearchResponse;
        const filtered = excludeCustomerId
          ? data.customers.filter((customer) => customer.id !== excludeCustomerId)
          : data.customers;
        setResults(filtered);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, minChars, excludeCustomerId]);

  function handleSelect(customer: CustomerSummary) {
    onSelect(customer);
    setQuery(customer.name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={`${listId}-input`} className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (value.trim().length < minChars) {
            setResults([]);
            setLoading(false);
          }
          setOpen(true);
        }}
        onFocus={() => {
          if (results.length > 0) {
            setOpen(true);
          }
        }}
        className="min-h-14 w-full rounded-xl border border-zinc-300 px-4 py-3 text-lg text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900"
      />
      {loading ? (
        <p className="mt-1 text-xs text-zinc-600">Searching…</p>
      ) : null}
      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {results.map((customer) => (
            <li
              key={customer.id}
              role="option"
              aria-selected={selectedCustomer?.id === customer.id}
            >
              <button
                type="button"
                onClick={() => handleSelect(customer)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
              >
                <CustomerAvatar
                  name={customer.name}
                  profilePhotoUrl={customer.profilePhotoUrl}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-zinc-900">{customer.name}</span>
                  <span className="block text-sm text-zinc-600">{customer.phone}</span>
                  {customer.isBlacklisted ? (
                    <span className="mt-1 block text-xs font-medium text-red-700">
                      Blacklisted
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && !loading && query.trim().length >= minChars && results.length === 0 ? (
        <p className="absolute z-20 mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-lg">
          No customers match that name or phone.
        </p>
      ) : null}
    </div>
  );
}
