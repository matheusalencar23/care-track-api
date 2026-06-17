import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { AppError } from "./appError";
import { logger } from "./logger";

export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || "Internal Server Error";

  logger.error(`${statusCode} - ${message}`);
  if (statusCode === 500) {
    logger.error(err.stack);
  }

  res.status(statusCode).json({
    statusCode,
    message,
  });
};
