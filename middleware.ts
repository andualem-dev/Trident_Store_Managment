import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";

import { type SessionData, getSessionOptions } from "@/lib/session";

const publicPaths = ["/login"];

function isPublicPath(pathname: string) {
  if (publicPaths.includes(pathname)) {
    return true;
  }
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return true;
  }
  if (pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    isPublicPath(pathname) ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/reports/") ||
    pathname === "/api/telegram/webhook"
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  let sessionOptions;
  try {
    sessionOptions = getSessionOptions();
  } catch (error) {
    console.error("Session configuration error:", error);
    return new NextResponse(
      "Server misconfigured: set SESSION_SECRET (32+ characters) in Vercel environment variables, then redeploy.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions,
  );

  if (!session.isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && !session.isAdmin) {
    const operatorEquipmentPath = "/admin/equipment";
    if (
      pathname === operatorEquipmentPath ||
      pathname.startsWith(`${operatorEquipmentPath}/`)
    ) {
      return response;
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
