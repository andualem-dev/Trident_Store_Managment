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

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "trident_operator_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Session cookie: lasts until the browser is closed (operator shift).
    maxAge: undefined,
  },
};
