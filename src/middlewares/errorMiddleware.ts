import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../shared/appLogger.js";
import { HttpException } from "../shared/exceptions/httpException.js";

export const errorMiddleware = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof HttpException) {
    AppLogger.error(`${err.statusCode} - ${err.message}`);
    return res.status(err.statusCode).json(err.toJson());
  }

  if (err instanceof Error) {
    const statusCode = 500;
    const message = "Internal Server Error";

    AppLogger.error(`${statusCode} - ${message}`);
    if (err.stack) {
      AppLogger.error(err.stack);
    }

    res.status(statusCode).json({
      message,
    });
  }

  next();
};
