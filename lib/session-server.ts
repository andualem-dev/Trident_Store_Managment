import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

import {
  defaultSession,
  type SessionData,
  getSessionOptions,
} from "@/lib/session";

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    getSessionOptions(),
  );

  if (!session.isLoggedIn) {
    return defaultSession;
  }

  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.operatorId) {
    throw new Error("Unauthorized");
  }
  return session as SessionData & {
    isLoggedIn: true;
    operatorId: string;
    name: string;
    isAdmin: boolean;
  };
}
