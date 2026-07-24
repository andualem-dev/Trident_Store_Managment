"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import type { CustomerSummary } from "@/lib/customers";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session-server";
import { saveCustomerImage } from "@/lib/uploads";

export type CustomerActionResult =
  | { ok: true; customer: CustomerSummary }
  | { ok: false; error: string };

function normalizePhone(phone: string) {
  return phone.trim();
}

export async function createCustomer(
  formData: FormData,
): Promise<CustomerActionResult> {
  try {
    const session = await requireSession();

    const name = String(formData.get("name") ?? "").trim();
    const phone = normalizePhone(String(formData.get("phone") ?? ""));
    const guarantorName = String(formData.get("guarantorName") ?? "").trim();
    const guarantorPhone = normalizePhone(
      String(formData.get("guarantorPhone") ?? ""),
    );

    if (!name) {
      return { ok: false, error: "Name is required." };
    }
    if (!phone) {
      return { ok: false, error: "Phone is required." };
    }

    const idCardFile = formData.get("idCardPhoto");
    const profileFile = formData.get("profilePhoto");

    const hasGuarantorFields =
      guarantorName.length > 0 || guarantorPhone.length > 0;
    if (hasGuarantorFields && (!guarantorName || !guarantorPhone)) {
      return {
        ok: false,
        error: "Guarantor requires both name and phone, or leave both empty.",
      };
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
      },
    });

    let idCardPhotoUrl: string | undefined;
    let profilePhotoUrl: string | undefined;

    try {
      if (idCardFile instanceof File && idCardFile.size > 0) {
        idCardPhotoUrl = await saveCustomerImage(
          customer.id,
          "id-card",
          idCardFile,
        );
      }
      if (profileFile instanceof File && profileFile.size > 0) {
        profilePhotoUrl = await saveCustomerImage(
          customer.id,
          "profile",
          profileFile,
        );
      }
    } catch (error) {
      await prisma.customer.delete({ where: { id: customer.id } });
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Photo upload failed.",
      };
    }

    if (idCardPhotoUrl || profilePhotoUrl) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          idCardPhotoUrl,
          profilePhotoUrl,
        },
      });
    }

    if (guarantorName && guarantorPhone) {
      await prisma.guarantor.create({
        data: {
          customerId: customer.id,
          name: guarantorName,
          phone: guarantorPhone,
        },
      });
    }

    await logAudit({
      operatorId: session.operatorId,
      action: "CREATE",
      entityType: "Customer",
      entityId: customer.id,
      details: {
        name,
        phone,
        hasIdCardPhoto: Boolean(idCardPhotoUrl),
        hasProfilePhoto: Boolean(profilePhotoUrl),
        hasGuarantor: Boolean(guarantorName && guarantorPhone),
      },
    });

    revalidatePath("/customers");

    return {
      ok: true,
      customer: {
        id: customer.id,
        name,
        phone,
        isBlacklisted: customer.isBlacklisted,
        idCardPhotoUrl,
        profilePhotoUrl,
      },
    };
  } catch {
    return { ok: false, error: "Could not register customer." };
  }
}
