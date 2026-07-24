"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export type OperatorRow = {
  id: string;
  name: string;
  uniqueCode: string;
  passwordPlain: string | null;
  isAdmin: boolean;
};

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

const MIN_PASSWORD_LENGTH = 4;

function parsePassword(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    return null;
  }
  return trimmed;
}

function slugifyCode(name: string) {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 12);

  return base.length > 0 ? base : "OP";
}

async function uniqueCodeForName(name: string) {
  const base = slugifyCode(name);
  let attempt = base;
  let suffix = 1;

  while (await prisma.operator.findUnique({ where: { uniqueCode: attempt } })) {
    attempt = `${base}${suffix}`;
    suffix += 1;
  }

  return attempt;
}

async function countAdmins(excludeId?: string) {
  return prisma.operator.count({
    where: {
      isAdmin: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function createOperator(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdminSession();
    const name = String(formData.get("name") ?? "").trim();
    const password = parsePassword(String(formData.get("password") ?? ""));
    const isAdmin = formData.get("isAdmin") === "true";

    if (!name) {
      return { ok: false, error: "Name is required." };
    }
    if (!password) {
      return {
        ok: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      };
    }

    const uniqueCode = await uniqueCodeForName(name);
    const passwordHash = await hashPassword(password);

    const operator = await prisma.operator.create({
      data: {
        name,
        uniqueCode,
        passwordHash,
        passwordPlain: password,
        isAdmin,
      },
    });

    await logAudit({
      operatorId: session.operatorId,
      action: "CREATE",
      entityType: "Operator",
      entityId: operator.id,
      details: {
        name,
        uniqueCode,
        isAdmin,
      },
    });

    revalidatePath("/admin/operators");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create operator." };
  }
}

export async function updateOperator(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdminSession();
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const isAdmin = formData.get("isAdmin") === "true";

    if (!id) {
      return { ok: false, error: "Missing operator id." };
    }
    if (!name) {
      return { ok: false, error: "Name is required." };
    }

    const existing = await prisma.operator.findUnique({ where: { id } });
    if (!existing) {
      return { ok: false, error: "Operator not found." };
    }

    if (existing.isAdmin && !isAdmin) {
      const otherAdmins = await countAdmins(id);
      if (otherAdmins === 0) {
        return { ok: false, error: "At least one admin must remain." };
      }
    }

    const operator = await prisma.operator.update({
      where: { id },
      data: { name, isAdmin },
    });

    await logAudit({
      operatorId: session.operatorId,
      action: "UPDATE",
      entityType: "Operator",
      entityId: operator.id,
      details: {
        before: {
          name: existing.name,
          isAdmin: existing.isAdmin,
        },
        after: {
          name,
          isAdmin,
        },
      },
    });

    revalidatePath("/admin/operators");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update operator." };
  }
}

export async function resetOperatorPassword(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdminSession();
    const id = String(formData.get("id") ?? "").trim();
    const password = parsePassword(String(formData.get("password") ?? ""));

    if (!id) {
      return { ok: false, error: "Missing operator id." };
    }
    if (!password) {
      return {
        ok: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      };
    }

    const existing = await prisma.operator.findUnique({ where: { id } });
    if (!existing) {
      return { ok: false, error: "Operator not found." };
    }

    const passwordHash = await hashPassword(password);

    await prisma.operator.update({
      where: { id },
      data: { passwordHash, passwordPlain: password },
    });

    await logAudit({
      operatorId: session.operatorId,
      action: "UPDATE",
      entityType: "Operator",
      entityId: existing.id,
      details: {
        field: "password",
        name: existing.name,
      },
    });

    revalidatePath("/admin/operators");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reset password." };
  }
}
