import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../shared/appLogger";
import User from "../models/user";
import { verifyToken } from "../utils/tokenUtils";
import { UnauthorizedException } from "../shared/exceptions/unauthorizedException";
import { HttpException } from "../shared/exceptions/httpException";

export const authenticationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.cookies.token) {
      return next(new UnauthorizedException("Invalid token"));
    }

    const token = req.cookies.token;
    if (!token) {
      return next(new UnauthorizedException("Invalid token"));
    }

    const verifiedToken = verifyToken(token);

    const user = await User.findOne({
      _id: verifiedToken._id,
    });

    if (!user) {
      return next(new UnauthorizedException("Invalid token"));
    }

    req.user = user;
    next();
  } catch (err) {
    AppLogger.error(`Authentication error: ${err}}`);
    return next(new HttpException("Internal Server Error", 500, null));
  }
};
