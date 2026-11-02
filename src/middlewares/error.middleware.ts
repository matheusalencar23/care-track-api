import { NextFunction, Request, Response } from "express";
import {
  ConflictException,
  HttpException,
} from "../shared/exceptions/index.js";
import { isDuplicateKeyError } from "../utils/mongo.utils.js";
import { AppLogger } from "../shared/appLogger.js";

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (isDuplicateKeyError(err)) {
    const conflict = new ConflictException("Conflict");
    AppLogger.error(`${conflict.statusCode} - Duplicate key error`);
    return res.status(conflict.statusCode).json(conflict.toJson());
  }

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
