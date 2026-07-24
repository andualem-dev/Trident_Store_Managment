import type { SessionOptions } from "iron-session";

export interface SessionData {
  operatorId?: string;
  name?: string;
  isAdmin?: boolean;
  isLoggedIn?: boolean;
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
};

export function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET?.trim();
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters long.",
    );
  }

  return {
    password,
    cookieName: "trident_operator_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  };
}
