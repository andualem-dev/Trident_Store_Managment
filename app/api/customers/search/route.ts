import { NextRequest, NextResponse } from "next/server";

import {
  normalizeCustomerSearchQuery,
  rankCustomerMatches,
} from "@/lib/customer-search";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session-server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const query = normalizeCustomerSearchQuery(
    params.get("q") ?? params.get("phone"),
  );

  if (query.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const matches = await prisma.customer.findMany({
    where: {
      OR: [
        {
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      isBlacklisted: true,
      idCardPhotoUrl: true,
      profilePhotoUrl: true,
    },
    take: 24,
  });

  const customers = rankCustomerMatches(matches, query).slice(0, 12);

  return NextResponse.json({ customers });
}
