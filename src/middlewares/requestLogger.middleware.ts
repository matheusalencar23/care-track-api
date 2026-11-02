import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../shared/appLogger.js";
import { runWithRequestContext } from "../shared/requestContext.js";

const REQUEST_ID_HEADER = "x-request-id";
const VALID_REQUEST_ID = /^[\w-]{1,128}$/;

const resolveRequestId = (req: Request) => {
  const incoming = req.header(REQUEST_ID_HEADER);
  return incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
};

export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestId = resolveRequestId(req);
  const startedAt = process.hrtime.bigint();

  res.setHeader(REQUEST_ID_HEADER, requestId);

  runWithRequestContext({ requestId, ip: req.ip }, () => {
    res.on("finish", () => {
      const context = {
        method: req.method,
        path: req.originalUrl.split("?")[0],
        statusCode: res.statusCode,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
      };

      if (res.statusCode >= 500) {
        AppLogger.error("Request completed", context);
      } else if (res.statusCode >= 400) {
        AppLogger.warn("Request completed", context);
      } else {
        AppLogger.info("Request completed", context);
      }
    });

    next();
  });
};
