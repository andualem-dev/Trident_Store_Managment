import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { findOperatorByPassword } from "@/lib/auth";
import {
  defaultSession,
  type SessionData,
  sessionOptions,
} from "@/lib/session";

export async function POST(request: Request) {
  let password: string;

  try {
    const body = (await request.json()) as { password?: string };
    password = body.password?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const operator = await findOperatorByPassword(password);
  if (!operator) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );

  session.operatorId = operator.id;
  session.name = operator.name;
  session.isAdmin = operator.isAdmin;
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({
    operator: {
      id: operator.id,
      name: operator.name,
      isAdmin: operator.isAdmin,
    },
  });
}

export async function DELETE() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );

  Object.assign(session, defaultSession);
  await session.save();

  return NextResponse.json({ ok: true });
}
