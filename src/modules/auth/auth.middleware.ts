import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import { errorDetails } from "../../shared/errorDetails.js";
import * as userRepository from "../user/user.repository.js";
import { verifyToken } from "../../utils/token.utils.js";
import {
  UnauthorizedException,
  HttpException,
} from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";

const isIssuedBeforePasswordChange = (
  issuedAt: number | undefined,
  passwordChangedAt: Date | null,
) => {
  if (!passwordChangedAt) {
    return false;
  }

  return (
    issuedAt === undefined ||
    issuedAt < Math.floor(passwordChangedAt.getTime() / 1000)
  );
};

export const authenticationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.cookies.token) {
      return next(new UnauthorizedException(messages.UNAUTHORIZED));
    }

    const token = req.cookies.token;
    if (!token) {
      return next(new UnauthorizedException(messages.UNAUTHORIZED));
    }

    const verifiedToken = verifyToken(token);

    if (typeof verifiedToken.sub !== "string") {
      return next(new UnauthorizedException(messages.UNAUTHORIZED));
    }

    const user = await userRepository.findById(verifiedToken.sub);

    if (!user) {
      return next(new UnauthorizedException(messages.UNAUTHORIZED));
    }

    if (
      isIssuedBeforePasswordChange(verifiedToken.iat, user.passwordChangedAt)
    ) {
      return next(new UnauthorizedException(messages.UNAUTHORIZED));
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      coren: user.coren,
      corenState: user.corenState,
    };
    next();
  } catch (err) {
    if (err instanceof HttpException) {
      return next(err);
    }

    AppLogger.error("Authentication error", errorDetails(err));
    return next(new HttpException(messages.INTERNAL_SERVER_ERROR, 500, null));
  }
};
