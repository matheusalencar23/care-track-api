import { NextFunction, Request, Response } from "express";
import {
  ConflictException,
  HttpException,
} from "../shared/exceptions/index.js";
import { isDuplicateKeyError } from "../utils/db.utils.js";
import { AppLogger } from "../shared/appLogger.js";
import { errorDetails } from "../shared/errorDetails.js";
import { MessageCode, messages } from "../shared/messages.js";

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (isDuplicateKeyError(err)) {
    const conflict = new ConflictException("CONFLICT");
    AppLogger.warn("Duplicate key error", { statusCode: conflict.statusCode });
    return res.status(conflict.statusCode).json(conflict.toJson());
  }

  if (err instanceof HttpException) {
    const context = { statusCode: err.statusCode, code: err.code };
    if (err.statusCode >= 500) {
      AppLogger.error(err.message, context);
    } else {
      AppLogger.warn(err.message, context);
    }
    return res.status(err.statusCode).json(err.toJson());
  }

  const statusCode = 500;
  const message = messages.INTERNAL_SERVER_ERROR;

  AppLogger.error(`${statusCode} - ${message}`, errorDetails(err));

  return res.status(statusCode).json({
    code: "INTERNAL_SERVER_ERROR" satisfies MessageCode,
    message,
  });
};
