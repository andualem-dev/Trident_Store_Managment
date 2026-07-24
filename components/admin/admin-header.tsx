import Link from "next/link";

export function AdminHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link
          href="/admin"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        ) : null}
      </div>
    </header>
  );
}
