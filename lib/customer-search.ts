import type { CustomerSummary } from "@/lib/customers";

export function normalizeCustomerSearchQuery(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function rankCustomerMatches(
  customers: CustomerSummary[],
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return customers;
  }

  return [...customers].sort((a, b) => {
    const score = (customer: CustomerSummary) => {
      const name = customer.name.toLowerCase();
      const phone = customer.phone.toLowerCase();
      if (name.startsWith(q)) {
        return 0;
      }
      if (name.includes(q)) {
        return 1;
      }
      if (phone.includes(q)) {
        return 2;
      }
      return 3;
    };

    const diff = score(a) - score(b);
    if (diff !== 0) {
      return diff;
    }
    return a.name.localeCompare(b.name);
  });
}
