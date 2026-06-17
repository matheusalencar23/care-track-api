import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { AppError } from "../shared/appError";
import { AppLogger } from "../shared/appLogger";

export class ErrorHandler {
  static handler: ErrorRequestHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const message = err.message || "Internal Server Error";

    AppLogger.error(`${statusCode} - ${message}`);
    if (statusCode === 500) {
      AppLogger.error(err.stack);
    }

    res.status(statusCode).json({
      message,
    });
  };
}
