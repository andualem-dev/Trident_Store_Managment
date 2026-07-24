"use server";

import { EquipmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { EQUIPMENT_CATEGORIES } from "@/lib/equipment-categories";
import { prisma } from "@/lib/prisma";

export type EquipmentRow = {
  id: string;
  name: string;
  category: string;
  dailyRate: string;
  status: EquipmentStatus;
};

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

function parseDailyRate(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
}

function normalizeCategory(category: string, customCategory: string): string | null {
  const trimmed = category.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === "Other") {
    const custom = customCategory.trim();
    return custom.length > 0 ? custom : null;
  }
  if (!(EQUIPMENT_CATEGORIES as readonly string[]).includes(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

export async function createEquipment(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdminSession();
    const name = String(formData.get("name") ?? "").trim();
    const category = normalizeCategory(
      String(formData.get("category") ?? ""),
      String(formData.get("customCategory") ?? ""),
    );
    const dailyRate = parseDailyRate(String(formData.get("dailyRate") ?? ""));

    if (!name) {
      return { ok: false, error: "Name is required." };
    }
    if (!category) {
      return { ok: false, error: "Category is required." };
    }
    if (dailyRate === null) {
      return { ok: false, error: "Daily rate must be a positive number." };
    }

    const equipment = await prisma.equipment.create({
      data: {
        name,
        category,
        dailyRate,
        status: EquipmentStatus.AVAILABLE,
      },
    });

    await logAudit({
      operatorId: session.operatorId,
      action: "CREATE",
      entityType: "Equipment",
      entityId: equipment.id,
      details: {
        name,
        category,
        dailyRate,
        status: equipment.status,
      },
    });

    revalidatePath("/admin/equipment");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create equipment." };
  }
}

export async function updateEquipment(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdminSession();
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const category = normalizeCategory(
      String(formData.get("category") ?? ""),
      String(formData.get("customCategory") ?? ""),
    );
    const dailyRate = parseDailyRate(String(formData.get("dailyRate") ?? ""));

    if (!id) {
      return { ok: false, error: "Missing equipment id." };
    }
    if (!name) {
      return { ok: false, error: "Name is required." };
    }
    if (!category) {
      return { ok: false, error: "Category is required." };
    }
    if (dailyRate === null) {
      return { ok: false, error: "Daily rate must be a positive number." };
    }

    const existing = await prisma.equipment.findUnique({ where: { id } });
    if (!existing) {
      return { ok: false, error: "Equipment not found." };
    }

    const equipment = await prisma.equipment.update({
      where: { id },
      data: { name, category, dailyRate },
    });

    await logAudit({
      operatorId: session.operatorId,
      action: "UPDATE",
      entityType: "Equipment",
      entityId: equipment.id,
      details: {
        before: {
          name: existing.name,
          category: existing.category,
          dailyRate: existing.dailyRate.toString(),
        },
        after: {
          name,
          category,
          dailyRate,
        },
      },
    });

    revalidatePath("/admin/equipment");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update equipment." };
  }
}

export async function setEquipmentMaintenance(
  equipmentId: string,
  toMaintenance: boolean,
): Promise<ActionResult> {
  try {
    const session = await requireAdminSession();
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
    });

    if (!equipment) {
      return { ok: false, error: "Equipment not found." };
    }

    if (toMaintenance) {
      if (equipment.status === EquipmentStatus.MAINTENANCE) {
        return { ok: false, error: "Already in maintenance." };
      }
      const updated = await prisma.equipment.update({
        where: { id: equipmentId },
        data: { status: EquipmentStatus.MAINTENANCE },
      });
      await logAudit({
        operatorId: session.operatorId,
        action: "UPDATE",
        entityType: "Equipment",
        entityId: equipment.id,
        details: {
          field: "status",
          from: equipment.status,
          to: updated.status,
        },
      });
    } else {
      if (equipment.status !== EquipmentStatus.MAINTENANCE) {
        return { ok: false, error: "Only maintenance items can be marked available here." };
      }

      const updated = await prisma.equipment.update({
        where: { id: equipmentId },
        data: { status: EquipmentStatus.AVAILABLE },
      });
      await logAudit({
        operatorId: session.operatorId,
        action: "UPDATE",
        entityType: "Equipment",
        entityId: equipment.id,
        details: {
          field: "status",
          from: equipment.status,
          to: updated.status,
        },
      });
    }

    revalidatePath("/admin/equipment");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update status." };
  }
}
