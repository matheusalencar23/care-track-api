import pino from "pino";
import { getRequestId } from "./requestContext.js";

const isDevelopment = (process.env.NODE_ENV ?? "development") === "development";

type LogContext = Record<string, unknown>;

export class AppLogger {
  private static _logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    mixin: () => {
      const requestId = getRequestId();
      return requestId ? { requestId } : {};
    },
    ...(isDevelopment && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
        },
      },
    }),
  });

  static debug(message: string, context: LogContext = {}) {
    this._logger.debug(context, message);
  }

  static info(message: string, context: LogContext = {}) {
    this._logger.info(context, message);
  }

  static warn(message: string, context: LogContext = {}) {
    this._logger.warn(context, message);
  }

  static error(message: string, context: LogContext = {}) {
    this._logger.error(context, message);
  }
}
