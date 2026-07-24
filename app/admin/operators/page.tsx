import { redirect } from "next/navigation";

import { AdminHeader } from "@/components/admin/admin-header";
import { OperatorsAdminPanel } from "@/components/admin/operators-admin-panel";
import { LogoutButton } from "@/components/logout-button";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session-server";

import type { OperatorRow } from "./actions";

export default async function AdminOperatorsPage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/login");
  }

  if (!session.isAdmin) {
    redirect("/");
  }

  if (!session.operatorId) {
    redirect("/login");
  }

  const currentOperatorId = session.operatorId;

  const rows = await prisma.operator.findMany({
    select: {
      id: true,
      name: true,
      uniqueCode: true,
      isAdmin: true,
    },
    orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
  });

  const operators: OperatorRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    uniqueCode: row.uniqueCode,
    isAdmin: row.isAdmin,
  }));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <AdminHeader
          title="Operators"
          description="Add staff, set passwords, and grant admin access."
        />
        <LogoutButton />
      </div>

      <OperatorsAdminPanel
        operators={operators}
        currentOperatorId={currentOperatorId}
      />
    </div>
  );
}
