import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../shared/appLogger";
import { HttpException } from "../shared/exceptions/httpException";

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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
};
