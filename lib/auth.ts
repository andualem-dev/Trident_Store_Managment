import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export async function findOperatorByPassword(password: string) {
  const operators = await prisma.operator.findMany({
    select: {
      id: true,
      name: true,
      isAdmin: true,
      passwordHash: true,
    },
  });

  for (const operator of operators) {
    const matches = await bcrypt.compare(password, operator.passwordHash);
    if (matches) {
      return {
        id: operator.id,
        name: operator.name,
        isAdmin: operator.isAdmin,
      };
    }
  }

  return null;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
