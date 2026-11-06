import { NextFunction, Request, Response } from "express";
import {
  ConflictException,
  HttpException,
} from "../shared/exceptions/index.js";
import { isDuplicateKeyError } from "../utils/db.utils.js";
import { AppLogger } from "../shared/appLogger.js";
import { errorDetails } from "../shared/errorDetails.js";
import { MessageCode, messages } from "../shared/messages.js";

type BodyParserError = { type: string; status: number };

const isBodyParserError = (err: unknown): err is BodyParserError => {
  if (!(err instanceof Error)) {
    return false;
  }

  const { type, status } = err as Partial<BodyParserError>;

  return (
    typeof type === "string" &&
    typeof status === "number" &&
    status >= 400 &&
    status < 500
  );
};

const toHttpException = (err: unknown) => {
  if (!isBodyParserError(err)) {
    return err;
  }

  const code: MessageCode =
    err.type === "entity.too.large"
      ? "REQUEST_BODY_TOO_LARGE"
      : "INVALID_REQUEST_BODY";

  return new HttpException(code, err.status, null);
};

export const errorMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const err = toHttpException(error);

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
