import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { AppError } from "../shared/appError";
import { AppLogger } from "../shared/appLogger";
import { ValidationError } from "../shared/validationError";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof AppError) {
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
