"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import type { CustomerGuarantor, CustomerSummary } from "@/lib/customers";
import { mapGuarantors } from "@/lib/customers";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session-server";
import { saveCustomerImage } from "@/lib/uploads";

export type CustomerActionResult =
  | { ok: true; customer: CustomerSummary }
  | { ok: false; error: string };

export type CustomerPhotoActionResult =
  | { ok: true; customer: CustomerSummary }
  | { ok: false; error: string };

export type GuarantorActionResult =
  | { ok: true; guarantors: CustomerGuarantor[] }
  | { ok: false; error: string };

const guarantorInclude = {
  guarantors: {
    include: {
      guarantorCustomer: {
        select: { name: true, phone: true },
      },
    },
    orderBy: { id: "asc" as const },
  },
};

function normalizePhone(phone: string) {
  return phone.trim();
}

async function loadCustomerSummary(customerId: string): Promise<CustomerSummary | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      isBlacklisted: true,
      idCardPhotoUrl: true,
      profilePhotoUrl: true,
      ...guarantorInclude,
    },
  });

  if (!customer) {
    return null;
  }

  const { guarantors, ...rest } = customer;
  return {
    ...rest,
    guarantors: mapGuarantors(guarantors),
  };
}

async function validateGuarantorLink(customerId: string, guarantorCustomerId: string) {
  if (customerId === guarantorCustomerId) {
    return "A customer cannot be their own guarantor.";
  }

  const guarantorCustomer = await prisma.customer.findUnique({
    where: { id: guarantorCustomerId },
    select: { id: true, isBlacklisted: true },
  });

  if (!guarantorCustomer) {
    return "Selected guarantor customer was not found.";
  }

  if (guarantorCustomer.isBlacklisted) {
    return "A blacklisted customer cannot be a guarantor.";
  }

  return null;
}

export async function createCustomer(
  formData: FormData,
): Promise<CustomerActionResult> {
  try {
    const session = await requireSession();

    const name = String(formData.get("name") ?? "").trim();
    const phone = normalizePhone(String(formData.get("phone") ?? ""));
    const guarantorCustomerId = String(
      formData.get("guarantorCustomerId") ?? "",
    ).trim();

    if (!name) {
      return { ok: false, error: "Name is required." };
    }
    if (!phone) {
      return { ok: false, error: "Phone is required." };
    }

    const idCardFile = formData.get("idCardPhoto");
    const profileFile = formData.get("profilePhoto");

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

    if (guarantorCustomerId) {
      const guarantorError = await validateGuarantorLink(
        customer.id,
        guarantorCustomerId,
      );
      if (guarantorError) {
        await prisma.customer.delete({ where: { id: customer.id } });
        return { ok: false, error: guarantorError };
      }

      await prisma.guarantor.create({
        data: {
          customerId: customer.id,
          guarantorCustomerId,
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
        guarantorCustomerId: guarantorCustomerId || null,
      },
    });

    revalidatePath("/customers");

    const summary = await loadCustomerSummary(customer.id);
    if (!summary) {
      return { ok: false, error: "Could not load new customer." };
    }

    return { ok: true, customer: summary };
  } catch {
    return { ok: false, error: "Could not register customer." };
  }
}

export async function uploadCustomerProfilePhoto(
  customerId: string,
  formData: FormData,
): Promise<CustomerPhotoActionResult> {
  try {
    const session = await requireSession();

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      return { ok: false, error: "Customer not found." };
    }

    const profileFile = formData.get("profilePhoto");
    if (!(profileFile instanceof File) || profileFile.size === 0) {
      return { ok: false, error: "Choose a profile photo." };
    }

    let profilePhotoUrl: string;
    try {
      profilePhotoUrl = await saveCustomerImage(
        customerId,
        "profile",
        profileFile,
      );
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Profile upload failed.",
      };
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: { profilePhotoUrl },
    });

    await logAudit({
      operatorId: session.operatorId,
      action: "UPDATE",
      entityType: "Customer",
      entityId: customerId,
      details: { updatedProfilePhoto: true },
    });

    revalidatePath("/customers");

    const summary = await loadCustomerSummary(customerId);
    if (!summary) {
      return { ok: false, error: "Could not load customer." };
    }

    return { ok: true, customer: summary };
  } catch {
    return { ok: false, error: "Could not upload profile picture." };
  }
}

export async function linkGuarantor(
  customerId: string,
  guarantorCustomerId: string,
): Promise<GuarantorActionResult> {
  try {
    const session = await requireSession();

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      return { ok: false, error: "Customer not found." };
    }

    const validationError = await validateGuarantorLink(
      customerId,
      guarantorCustomerId,
    );
    if (validationError) {
      return { ok: false, error: validationError };
    }

    await prisma.guarantor.upsert({
      where: {
        customerId_guarantorCustomerId: {
          customerId,
          guarantorCustomerId,
        },
      },
      create: {
        customerId,
        guarantorCustomerId,
      },
      update: {},
    });

    const updated = await prisma.customer.findUnique({
      where: { id: customerId },
      select: guarantorInclude,
    });

    await logAudit({
      operatorId: session.operatorId,
      action: "UPDATE",
      entityType: "Customer",
      entityId: customerId,
      details: {
        linkedGuarantorCustomerId: guarantorCustomerId,
      },
    });

    revalidatePath("/customers");

    return {
      ok: true,
      guarantors: mapGuarantors(updated?.guarantors ?? []),
    };
  } catch {
    return { ok: false, error: "Could not link guarantor." };
  }
}

export async function removeGuarantor(
  customerId: string,
  guarantorId: string,
): Promise<GuarantorActionResult> {
  try {
    const session = await requireSession();

    const link = await prisma.guarantor.findFirst({
      where: { id: guarantorId, customerId },
      select: { id: true, guarantorCustomerId: true },
    });

    if (!link) {
      return { ok: false, error: "Guarantor link not found." };
    }

    await prisma.guarantor.delete({ where: { id: guarantorId } });

    const updated = await prisma.customer.findUnique({
      where: { id: customerId },
      select: guarantorInclude,
    });

    await logAudit({
      operatorId: session.operatorId,
      action: "UPDATE",
      entityType: "Customer",
      entityId: customerId,
      details: {
        removedGuarantorCustomerId: link.guarantorCustomerId,
      },
    });

    revalidatePath("/customers");

    return {
      ok: true,
      guarantors: mapGuarantors(updated?.guarantors ?? []),
    };
  } catch {
    return { ok: false, error: "Could not remove guarantor." };
  }
}
