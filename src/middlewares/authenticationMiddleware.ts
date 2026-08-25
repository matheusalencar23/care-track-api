import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../shared/appLogger.js";
import User from "../models/user.js";
import { verifyToken } from "../utils/tokenUtils.js";
import { UnauthorizedException } from "../shared/exceptions/unauthorizedException.js";
import { HttpException } from "../shared/exceptions/httpException.js";

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

    req.user = {
      name: user.name,
      email: user.email,
    };
    next();
  } catch (err) {
    AppLogger.error(`Authentication error: ${err}}`);
    return next(new HttpException("Internal Server Error", 500, null));
  }
};
