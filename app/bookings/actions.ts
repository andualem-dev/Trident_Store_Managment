"use server";

import { BookingStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  bookingOverlapWhere,
  parseBookingDate,
} from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session-server";

export type CreatedBooking = {
  id: string;
  customerName: string;
  equipmentName: string;
  startDate: string;
  endDate: string;
};

export type BookingActionResult =
  | {
      ok: true;
      bookings?: CreatedBooking[];
    }
  | { ok: false; error: string };

export async function createBooking(input: {
  customerId: string;
  equipmentIds: string[];
  startDate: string;
  endDate: string;
}): Promise<BookingActionResult> {
  const session = await requireSession();
  const customerId = input.customerId.trim();
  const equipmentIds = [...new Set(input.equipmentIds.filter(Boolean))];
  const startDate = parseBookingDate(input.startDate, "start");
  const endDate = parseBookingDate(input.endDate, "end");
  const today = parseBookingDate(
    new Date().toISOString().slice(0, 10),
    "start",
  )!;

  if (!customerId) {
    return { ok: false, error: "Select a customer." };
  }
  if (equipmentIds.length === 0) {
    return { ok: false, error: "Select at least one equipment item." };
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
    const bookings = await prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true, phone: true },
        });

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        const equipment = await tx.equipment.findMany({
          where: { id: { in: equipmentIds } },
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }],
        });

        if (equipment.length !== equipmentIds.length) {
          throw new Error("EQUIPMENT_NOT_FOUND");
        }

        for (const item of equipment) {
          const overlap = await tx.booking.findFirst({
            where: bookingOverlapWhere(item.id, startDate, endDate),
            select: { id: true },
          });
          if (overlap) {
            throw new Error(`BOOKING_OVERLAP:${item.name}`);
          }
        }

        const created: CreatedBooking[] = [];

        for (const item of equipment) {
          const booking = await tx.booking.create({
            data: {
              customerId: customer.id,
              operatorId: session.operatorId,
              equipmentId: item.id,
              startDate,
              endDate,
              status: BookingStatus.UPCOMING,
            },
          });

          created.push({
            id: booking.id,
            customerName: customer.name,
            equipmentName: item.name,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          });
        }

        await tx.auditLog.create({
          data: {
            action: "BOOKING_CREATED",
            operatorId: session.operatorId,
            entityType: "Booking",
            entityId: created[0]?.id ?? customer.id,
            details: {
              customer: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
              },
              equipment: equipment.map((item) => ({
                id: item.id,
                name: item.name,
              })),
              count: created.length,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            },
          },
        });

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/bookings");
    revalidatePath("/bookings/new");
    revalidatePath("/rentals/new");
    return { ok: true, bookings };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("BOOKING_OVERLAP:")) {
        const equipmentName = error.message.slice("BOOKING_OVERLAP:".length);
        return {
          ok: false,
          error: `${equipmentName} is already booked for an overlapping date range.`,
        };
      }
      if (error.message === "BOOKING_OVERLAP") {
        return {
          ok: false,
          error:
            "One or more items are already booked for an overlapping date range.",
        };
      }
      if (error.message === "CUSTOMER_NOT_FOUND") {
        return { ok: false, error: "That customer no longer exists." };
      }
      if (error.message === "EQUIPMENT_NOT_FOUND") {
        return { ok: false, error: "One or more selected items no longer exist." };
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
