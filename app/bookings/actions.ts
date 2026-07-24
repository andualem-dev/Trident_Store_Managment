"use server";

import { BookingStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  bookingOverlapWhere,
  parseBookingDate,
} from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session-server";

export type BookingActionResult =
  | {
      ok: true;
      booking?: {
        id: string;
        customerName: string;
        equipmentName: string;
        startDate: string;
        endDate: string;
      };
    }
  | { ok: false; error: string };

export async function createBooking(input: {
  customerId: string;
  equipmentId: string;
  startDate: string;
  endDate: string;
}): Promise<BookingActionResult> {
  const session = await requireSession();
  const customerId = input.customerId.trim();
  const equipmentId = input.equipmentId.trim();
  const startDate = parseBookingDate(input.startDate, "start");
  const endDate = parseBookingDate(input.endDate, "end");
  const today = parseBookingDate(
    new Date().toISOString().slice(0, 10),
    "start",
  )!;

  if (!customerId) {
    return { ok: false, error: "Select a customer." };
  }
  if (!equipmentId) {
    return { ok: false, error: "Select one equipment item." };
  }
  if (!startDate || !endDate) {
    return { ok: false, error: "Choose a valid start and end date." };
  }
  if (startDate < today) {
    return { ok: false, error: "The booking start date cannot be in the past." };
  }
  if (endDate < startDate) {
    return { ok: false, error: "End date must be on or after start date." };
  }

  try {
    const booking = await prisma.$transaction(
      async (tx) => {
        const [customer, equipment, overlap] = await Promise.all([
          tx.customer.findUnique({
            where: { id: customerId },
            select: { id: true, name: true, phone: true },
          }),
          tx.equipment.findUnique({
            where: { id: equipmentId },
            select: { id: true, name: true },
          }),
          tx.booking.findFirst({
            where: bookingOverlapWhere(equipmentId, startDate, endDate),
            select: { id: true, startDate: true, endDate: true },
          }),
        ]);

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }
        if (!equipment) {
          throw new Error("EQUIPMENT_NOT_FOUND");
        }
        if (overlap) {
          throw new Error("BOOKING_OVERLAP");
        }

        const created = await tx.booking.create({
          data: {
            customerId: customer.id,
            operatorId: session.operatorId,
            equipmentId: equipment.id,
            startDate,
            endDate,
            status: BookingStatus.UPCOMING,
          },
        });

        await tx.auditLog.create({
          data: {
            action: "BOOKING_CREATED",
            operatorId: session.operatorId,
            entityType: "Booking",
            entityId: created.id,
            details: {
              customer: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
              },
              equipment: {
                id: equipment.id,
                name: equipment.name,
              },
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            },
          },
        });

        return {
          id: created.id,
          customerName: customer.name,
          equipmentName: equipment.name,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/bookings");
    revalidatePath("/bookings/new");
    revalidatePath("/rentals/new");
    return { ok: true, booking };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "BOOKING_OVERLAP") {
        return {
          ok: false,
          error:
            "That equipment is already booked for an overlapping date range.",
        };
      }
      if (error.message === "CUSTOMER_NOT_FOUND") {
        return { ok: false, error: "That customer no longer exists." };
      }
      if (error.message === "EQUIPMENT_NOT_FOUND") {
        return { ok: false, error: "That equipment no longer exists." };
      }
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        ok: false,
        error:
          "Another booking was created at the same time. Review the dates and try again.",
      };
    }
    return { ok: false, error: "Could not create the booking. Try again." };
  }
}

export async function cancelBooking(
  bookingId: string,
): Promise<BookingActionResult> {
  const session = await requireSession();
  const id = bookingId.trim();

  if (!id) {
    return { ok: false, error: "Missing booking id." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: {
          id,
          status: { in: [BookingStatus.UPCOMING, BookingStatus.ACTIVE] },
        },
        include: {
          customer: { select: { name: true } },
          equipment: { select: { name: true } },
        },
      });
      if (!booking) {
        throw new Error("BOOKING_NOT_ACTIVE");
      }

      const updated = await tx.booking.updateMany({
        where: {
          id,
          status: { in: [BookingStatus.UPCOMING, BookingStatus.ACTIVE] },
        },
        data: { status: BookingStatus.CANCELLED },
      });
      if (updated.count !== 1) {
        throw new Error("BOOKING_NOT_ACTIVE");
      }

      await tx.auditLog.create({
        data: {
          action: "BOOKING_CANCELLED",
          operatorId: session.operatorId,
          entityType: "Booking",
          entityId: booking.id,
          details: {
            customer: booking.customer.name,
            equipment: booking.equipment.name,
            startDate: booking.startDate.toISOString(),
            endDate: booking.endDate.toISOString(),
          },
        },
      });
    });

    revalidatePath("/bookings");
    revalidatePath("/bookings/new");
    revalidatePath("/rentals/new");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "BOOKING_NOT_ACTIVE") {
      return {
        ok: false,
        error: "This booking is already cancelled or has expired.",
      };
    }
    return { ok: false, error: "Could not cancel the booking. Try again." };
  }
}
