import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { getSession } from "@/lib/session-server";

export default async function AdminPage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/login");
  }

  if (!session.isAdmin) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-600">
            Admin
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Admin dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Signed in as {session.name}.
          </p>
        </div>
        <LogoutButton />
      </header>

      <nav className="flex flex-col gap-2">
        <Link
          href="/customers"
          className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-base font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Customers
        </Link>
        <Link
          href="/admin/operators"
          className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-base font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Operators
        </Link>
        <Link
          href="/admin/equipment"
          className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-base font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Equipment management
        </Link>
      </nav>
    </div>
  );
}
