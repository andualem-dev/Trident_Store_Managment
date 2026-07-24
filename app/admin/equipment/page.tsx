import { redirect } from "next/navigation";

import { AdminHeader } from "@/components/admin/admin-header";
import { EquipmentAdminPanel } from "@/components/admin/equipment-admin-panel";
import { LogoutButton } from "@/components/logout-button";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session-server";

import type { EquipmentRow } from "./actions";

export default async function AdminEquipmentPage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/login");
  }

  if (!session.isAdmin) {
    redirect("/");
  }

  const rows = await prisma.equipment.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const equipment: EquipmentRow[] = rows.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    dailyRate: item.dailyRate.toString(),
    status: item.status,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <AdminHeader
          title="Equipment"
          description="Manage inventory, pricing, and maintenance status."
        />
        <LogoutButton />
      </div>

      <EquipmentAdminPanel equipment={equipment} />
    </div>
  );
}
