import { NextFunction, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { AppLogger } from "../../shared/appLogger.js";
import { errorDetails } from "../../shared/errorDetails.js";
import * as userRepository from "../user/user.repository.js";
import { verifyToken } from "../../utils/token.utils.js";
import {
  UnauthorizedException,
  HttpException,
} from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";
import { createSession, SESSION_COOKIE, setSessionCookie } from "./session.js";

const isLoggedInBeforePasswordChange = (
  authTime: number,
  passwordChangedAt: Date | null,
) => {
  if (!passwordChangedAt) {
    return false;
  }

  return authTime < Math.floor(passwordChangedAt.getTime() / 1000);
};

const resolveAuthTime = (payload: JwtPayload): number | undefined => {
  if (typeof payload["auth_time"] === "number") {
    return payload["auth_time"];
  }

  return payload.iat;
};

export const authenticationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) {
      return next(new UnauthorizedException(messages.UNAUTHORIZED));
    }

    const verifiedToken = verifyToken(token);

    const authTime = resolveAuthTime(verifiedToken);

    if (typeof verifiedToken.sub !== "string" || authTime === undefined) {
      return next(new UnauthorizedException(messages.UNAUTHORIZED));
    }

    const user = await userRepository.findById(verifiedToken.sub);

    if (!user) {
      return next(new UnauthorizedException(messages.UNAUTHORIZED));
    }

    if (isLoggedInBeforePasswordChange(authTime, user.passwordChangedAt)) {
      return next(new UnauthorizedException(messages.UNAUTHORIZED));
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      coren: user.coren,
      corenState: user.corenState,
    };

    const session = createSession(user.id, authTime);
    setSessionCookie(res, session);
    req.sessionExpiresAt = session.expiresAt;

    next();
  } catch (err) {
    if (err instanceof HttpException) {
      return next(err);
    }

    AppLogger.error("Authentication error", errorDetails(err));
    return next(new HttpException(messages.INTERNAL_SERVER_ERROR, 500, null));
  }
};
