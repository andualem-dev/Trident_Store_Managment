import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function logAudit(params: {
  operatorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      operatorId: params.operatorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details,
    },
  });
}
