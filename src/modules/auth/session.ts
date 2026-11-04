import { CookieOptions, Response } from "express";
import { NODE_ENV } from "../../config/secrets.js";
import { generateToken } from "../../utils/token.utils.js";

export const SESSION_IDLE_TIMEOUT_SECONDS = 30 * 60;
export const SESSION_MAX_DURATION_SECONDS = 12 * 60 * 60;

export const SESSION_COOKIE = "token";
export const SESSION_EXPIRES_HEADER = "X-Session-Expires-At";

export interface Session {
  token: string;
  expiresAt: Date;
}

const nowInSeconds = () => Math.floor(Date.now() / 1000);

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
};

export const createSession = (
  userId: string,
  authTime: number = nowInSeconds(),
): Session => {
  const expiresAt = Math.min(
    nowInSeconds() + SESSION_IDLE_TIMEOUT_SECONDS,
    authTime + SESSION_MAX_DURATION_SECONDS,
  );

  return {
    token: generateToken({ sub: userId, auth_time: authTime }, expiresAt),
    expiresAt: new Date(expiresAt * 1000),
  };
};

export const setSessionCookie = (res: Response, session: Session) => {
  res.cookie(SESSION_COOKIE, session.token, {
    ...cookieOptions,
    expires: session.expiresAt,
  });
  res.setHeader(SESSION_EXPIRES_HEADER, session.expiresAt.toISOString());
};

export const clearSessionCookie = (res: Response) => {
  const setCookie = res.getHeader("Set-Cookie");

  if (Array.isArray(setCookie)) {
    const others = setCookie.filter(
      (cookie) => !cookie.startsWith(`${SESSION_COOKIE}=`),
    );
    if (others.length > 0) {
      res.setHeader("Set-Cookie", others);
    } else {
      res.removeHeader("Set-Cookie");
    }
  } else if (
    typeof setCookie === "string" &&
    setCookie.startsWith(`${SESSION_COOKIE}=`)
  ) {
    res.removeHeader("Set-Cookie");
  }

  res.removeHeader(SESSION_EXPIRES_HEADER);
  res.clearCookie(SESSION_COOKIE, cookieOptions);
};
