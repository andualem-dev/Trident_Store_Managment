import Link from "next/link";
import { redirect } from "next/navigation";

import { CustomersPageClient } from "@/components/customers/customers-page-client";
import { LogoutButton } from "@/components/logout-button";
import type { CustomerListRow } from "@/lib/customers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session-server";

export default async function CustomersPage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/login");
  }

  const rows = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      isBlacklisted: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const customers: CustomerListRow[] = rows;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            ← Counter
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Customers</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Register and find customers by phone. Open to all signed-in operators.
          </p>
        </div>
        <LogoutButton />
      </header>

      <CustomersPageClient customers={customers} />
    </div>
  );
}
