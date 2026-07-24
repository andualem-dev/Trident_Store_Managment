import { getSession } from "@/lib/session-server";

export async function requireAdminSession() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.operatorId) {
    throw new Error("Unauthorized");
  }
  if (!session.isAdmin) {
    throw new Error("Forbidden");
  }
  return session as {
    isLoggedIn: true;
    operatorId: string;
    name: string;
    isAdmin: true;
  };
}
