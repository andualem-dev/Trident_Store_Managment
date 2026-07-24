import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeCustomerSearchQuery,
  rankCustomerMatches,
} from "@/lib/customer-search";
import type { CustomerSummary } from "@/lib/customers";

const customers: CustomerSummary[] = [
  {
    id: "1",
    name: "Alice Abebe",
    phone: "0911111111",
    isBlacklisted: false,
  },
  {
    id: "2",
    name: "Bekele Tadesse",
    phone: "0922222222",
    isBlacklisted: false,
  },
  {
    id: "3",
    name: "Chaltu Girma",
    phone: "0933333333",
    isBlacklisted: false,
  },
];

describe("rankCustomerMatches", () => {
  it("ranks name prefix matches ahead of phone-only matches", () => {
    const ranked = rankCustomerMatches(customers, "be");
    assert.equal(ranked[0]?.name, "Bekele Tadesse");
  });

  it("ranks name contains ahead of phone-only matches", () => {
    const ranked = rankCustomerMatches(customers, "alt");
    assert.equal(ranked[0]?.name, "Chaltu Girma");
  });

  it("still finds customers by phone", () => {
    const ranked = rankCustomerMatches(customers, "922");
    assert.equal(ranked[0]?.name, "Bekele Tadesse");
  });
});

describe("normalizeCustomerSearchQuery", () => {
  it("trims whitespace", () => {
    assert.equal(normalizeCustomerSearchQuery("  abe  "), "abe");
  });
});
