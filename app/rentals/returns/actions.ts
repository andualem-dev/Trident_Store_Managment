"use server";

import {
  EquipmentStatus,
  Prisma,
  RentalStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { calculateLateFeeForItems } from "@/lib/late-fee";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session-server";

export type ReturnRentalResult =
  | {
      ok: true;
      returned: {
        rentalId: string;
        customerName: string;
        returnedAt: string;
        lateFee: string;
        grandTotal: string;
      };
    }
  | { ok: false; error: string };

export async function returnRental(
  rentalId: string,
): Promise<ReturnRentalResult> {
  const session = await requireSession();
  const id = rentalId.trim();

  if (!id) {
    return { ok: false, error: "Missing rental id." };
  }

  try {
    const returned = await prisma.$transaction(
      async (tx) => {
        const [rental, settings] = await Promise.all([
          tx.rental.findFirst({
            where: { id, status: RentalStatus.ACTIVE },
            include: {
              customer: { select: { name: true } },
              items: {
                include: {
                  equipment: {
                    select: {
                      id: true,
                      name: true,
                      dailyRate: true,
                      weekendDailyRate: true,
                    },
                  },
                },
              },
            },
          }),
          tx.settings.findUnique({ where: { id: 1 } }),
        ]);

        if (!rental) {
          throw new Error("RENTAL_NOT_ACTIVE");
        }
        if (!settings) {
          throw new Error("SETTINGS_MISSING");
        }

        const returnedAt = new Date();
        const fee = calculateLateFeeForItems({
          items: rental.items.map((item) => ({
            dailyRate: item.equipment.dailyRate.toNumber(),
            weekendDailyRate: item.equipment.weekendDailyRate?.toNumber() ?? null,
          })),
          dueAt: rental.dueAt,
          returnedAt,
          gracePeriodMinutes: settings.gracePeriodMinutes,
        });
        const lateFee = new Prisma.Decimal(fee.lateFeeCents).div(100);
        const grandTotal = rental.totalCost.add(lateFee);

        const rentalUpdate = await tx.rental.updateMany({
          where: { id, status: RentalStatus.ACTIVE },
          data: {
            returnedAt,
            status: RentalStatus.RETURNED,
            lateFee,
          },
        });
        if (rentalUpdate.count !== 1) {
          throw new Error("RENTAL_NOT_ACTIVE");
        }

        const equipmentIds = rental.items.map(
          (item) => item.equipment.id,
        );
        await tx.equipment.updateMany({
          where: {
            id: { in: equipmentIds },
            status: { not: EquipmentStatus.MAINTENANCE },
          },
          data: { status: EquipmentStatus.AVAILABLE },
        });

        await tx.auditLog.create({
          data: {
            action: "RENTAL_RETURNED",
            operatorId: session.operatorId,
            entityType: "Rental",
            entityId: rental.id,
            details: {
              customer: rental.customer.name,
              returnedAt: returnedAt.toISOString(),
              dueAt: rental.dueAt.toISOString(),
              gracePeriodMinutes: settings.gracePeriodMinutes,
              extraDays: fee.extraDays,
              lateFee: lateFee.toFixed(2),
              originalTotal: rental.totalCost.toFixed(2),
              grandTotal: grandTotal.toFixed(2),
              items: rental.items.map((item) => ({
                id: item.equipment.id,
                name: item.equipment.name,
              })),
            },
          },
        });

        return {
          rentalId: rental.id,
          customerName: rental.customer.name,
          returnedAt: returnedAt.toISOString(),
          lateFee: lateFee.toFixed(2),
          grandTotal: grandTotal.toFixed(2),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/rentals/returns");
    revalidatePath("/rentals/new");
    revalidatePath("/admin/equipment");
    return { ok: true, returned };
  } catch (error) {
    if (error instanceof Error && error.message === "RENTAL_NOT_ACTIVE") {
      return {
        ok: false,
        error: "This rental has already been returned or is no longer active.",
      };
    }
    if (error instanceof Error && error.message === "SETTINGS_MISSING") {
      return {
        ok: false,
        error: "Grace-period settings are missing. Ask an admin to configure them.",
      };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        ok: false,
        error: "The rental changed at the same time. Refresh and try again.",
      };
    }
    return { ok: false, error: "Could not process the return. Try again." };
  }
}
