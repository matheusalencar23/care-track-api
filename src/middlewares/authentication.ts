import { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/appError";
import { AppLogger } from "../shared/appLogger";
import User from "../models/user";
import { verifyToken } from "../utils/tokenUtils";

export const authentication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.headers.authorization) {
      return next(new AppError("Unauthorized", 401));
    }

    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return next(new AppError("Unauthorized", 401));
    }

    const verifiedToken = verifyToken(token);

    const user = await User.findOne({
      _id: verifiedToken._id,
    });

    if (!user) {
      return next(new AppError("Unauthorized", 401));
    }

    req.user = user;
    next();
  } catch (err) {
    if ((err as any).name === "TokenExpiredError") {
      AppLogger.error(`Access token has expired: ${err}}`);
      return next(new AppError("Unauthorized", 401));
    }
    AppLogger.error(`Error in authentication: ${err}}`);
    return next(new AppError("Internal Server Error", 500));
  }
};
