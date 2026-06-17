import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { AppLogger } from "./appLogger";

export class AppError extends Error {
  private _statusCode: number;

  public get statusCode() {
    return this._statusCode;
  }

  constructor(message: string, statusCode: number) {
    super(message);
    this._statusCode = statusCode;
  }

  static errorHandler: ErrorRequestHandler = (
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
      statusCode,
      message,
    });
  };
}
