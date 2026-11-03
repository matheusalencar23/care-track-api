import { NextFunction, Request, Response } from "express";
import {
  ConflictException,
  HttpException,
} from "../shared/exceptions/index.js";
import { isDuplicateKeyError } from "../utils/mongo.utils.js";
import { AppLogger } from "../shared/appLogger.js";
import { messages } from "../shared/messages.js";

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (isDuplicateKeyError(err)) {
    const conflict = new ConflictException(messages.CONFLICT);
    AppLogger.warn("Duplicate key error", { statusCode: conflict.statusCode });
    return res.status(conflict.statusCode).json(conflict.toJson());
  }

  if (err instanceof HttpException) {
    const context = { statusCode: err.statusCode };
    if (err.statusCode >= 500) {
      AppLogger.error(err.message, context);
    } else {
      AppLogger.warn(err.message, context);
    }
    return res.status(err.statusCode).json(err.toJson());
  }

  const statusCode = 500;
  const message = messages.INTERNAL_SERVER_ERROR;

  AppLogger.error(`${statusCode} - ${message}`);
  if (err instanceof Error && err.stack) {
    AppLogger.error(err.stack);
  }

  return res.status(statusCode).json({
    message,
  });
};
