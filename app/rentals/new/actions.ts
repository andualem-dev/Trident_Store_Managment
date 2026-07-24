"use server";

import {
  BookingStatus,
  EquipmentStatus,
  Prisma,
  RentalStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session-server";

export type RentalReceipt = {
  rentalId: string;
  customer: {
    name: string;
    phone: string;
  };
  operatorName: string;
  items: Array<{
    id: string;
    name: string;
    category: string;
    dailyRate: string;
  }>;
  days: number;
  startAt: string;
  dueAt: string;
  totalCost: string;
};

export type CreateRentalResult =
  | { ok: true; receipt: RentalReceipt }
  | { ok: false; error: string };

function rentalError(error: unknown): CreateRentalResult {
  if (
    error instanceof Error &&
    (error.message === "CUSTOMER_NOT_FOUND" ||
      error.message === "EQUIPMENT_UNAVAILABLE")
  ) {
    return {
      ok: false,
      error:
        error.message === "CUSTOMER_NOT_FOUND"
          ? "That customer no longer exists. Select the customer again."
          : "One or more selected items are no longer available. The list has been refreshed.",
    };
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return {
      ok: false,
      error:
        "Another operator updated this equipment at the same time. Review the refreshed list and try again.",
    };
  }

  return { ok: false, error: "Could not create the rental. Please try again." };
}

export async function createRental(input: {
  customerId: string;
  equipmentIds: string[];
  days: number;
}): Promise<CreateRentalResult> {
  const session = await requireSession();
  const customerId = input.customerId.trim();
  const equipmentIds = [...new Set(input.equipmentIds.filter(Boolean))];
  const days = Number(input.days);

  if (!customerId) {
    return { ok: false, error: "Select a customer." };
  }
  if (equipmentIds.length === 0) {
    return { ok: false, error: "Select at least one equipment item." };
  }
  if (!Number.isInteger(days) || days < 1 || days > 14) {
    return { ok: false, error: "Rental duration must be between 1 and 14 days." };
  }

  try {
    const receipt = await prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true, phone: true },
        });
        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        const startAt = new Date();
        const equipment = await tx.equipment.findMany({
          where: {
            id: { in: equipmentIds },
            status: EquipmentStatus.AVAILABLE,
            bookings: {
              none: {
                status: {
                  in: [BookingStatus.UPCOMING, BookingStatus.ACTIVE],
                },
                startDate: { lte: startAt },
                endDate: { gte: startAt },
              },
            },
          },
          select: {
            id: true,
            name: true,
            category: true,
            dailyRate: true,
          },
          orderBy: [{ category: "asc" }, { name: "asc" }],
        });

        if (equipment.length !== equipmentIds.length) {
          throw new Error("EQUIPMENT_UNAVAILABLE");
        }

        const dailyTotal = equipment.reduce(
          (sum, item) => sum.add(item.dailyRate),
          new Prisma.Decimal(0),
        );
        const totalCost = dailyTotal.mul(days);
        const dueAt = new Date(startAt.getTime() + days * 24 * 60 * 60 * 1000);

        const statusUpdate = await tx.equipment.updateMany({
          where: {
            id: { in: equipmentIds },
            status: EquipmentStatus.AVAILABLE,
          },
          data: { status: EquipmentStatus.RENTED },
        });
        if (statusUpdate.count !== equipmentIds.length) {
          throw new Error("EQUIPMENT_UNAVAILABLE");
        }

        const rental = await tx.rental.create({
          data: {
            customerId: customer.id,
            operatorId: session.operatorId,
            days,
            startAt,
            dueAt,
            totalCost,
            status: RentalStatus.ACTIVE,
            items: {
              create: equipmentIds.map((equipmentId) => ({ equipmentId })),
            },
          },
        });

        await tx.auditLog.create({
          data: {
            action: "RENTAL_CREATED",
            operatorId: session.operatorId,
            entityType: "Rental",
            entityId: rental.id,
            details: {
              customer: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
              },
              days,
              items: equipment.map((item) => ({
                id: item.id,
                name: item.name,
                dailyRate: item.dailyRate.toString(),
              })),
              totalCost: totalCost.toFixed(2),
              startAt: startAt.toISOString(),
              dueAt: dueAt.toISOString(),
            },
          },
        });

        return {
          rentalId: rental.id,
          customer: {
            name: customer.name,
            phone: customer.phone,
          },
          operatorName: session.name,
          items: equipment.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            dailyRate: item.dailyRate.toFixed(2),
          })),
          days,
          startAt: startAt.toISOString(),
          dueAt: dueAt.toISOString(),
          totalCost: totalCost.toFixed(2),
        } satisfies RentalReceipt;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/rentals/new");
    revalidatePath("/admin/equipment");
    return { ok: true, receipt };
  } catch (error) {
    return rentalError(error);
  }
}
