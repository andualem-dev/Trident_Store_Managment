import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash("admin123", 12);
  const op1Hash = await bcrypt.hash("op1pass", 12);
  const op2Hash = await bcrypt.hash("op2pass", 12);

  await prisma.operator.deleteMany();

  await prisma.operator.createMany({
    data: [
      {
        name: "Admin",
        uniqueCode: "ADMIN",
        passwordHash: adminHash,
        passwordPlain: "admin123",
        isAdmin: true,
      },
      {
        name: "Operator One",
        uniqueCode: "OP1",
        passwordHash: op1Hash,
        passwordPlain: "op1pass",
        isAdmin: false,
      },
      {
        name: "Operator Two",
        uniqueCode: "OP2",
        passwordHash: op2Hash,
        passwordPlain: "op2pass",
        isAdmin: false,
      },
    ],
  });

  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, gracePeriodMinutes: 20 },
    update: { gracePeriodMinutes: 20 },
  });

  console.log("Seed complete: 3 operators + default settings (grace 20 min).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
