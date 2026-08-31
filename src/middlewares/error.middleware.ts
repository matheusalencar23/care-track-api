import { NextFunction, Request, Response } from "express";
import { HttpException } from "../shared/exceptions/index.js";
import { AppLogger } from "../shared/appLogger.js";

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof HttpException) {
    AppLogger.error(`${err.statusCode} - ${err.message}`);
    return res.status(err.statusCode).json(err.toJson());
  }

  const statusCode = 500;
  const message = "Internal Server Error";

  AppLogger.error(`${statusCode} - ${message}`);
  if (err instanceof Error && err.stack) {
    AppLogger.error(err.stack);
  }

  return res.status(statusCode).json({
    message,
  });
};
