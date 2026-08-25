import pino from "pino";
import { NODE_ENV } from "../config/secrets.js";

const isDevelopment = NODE_ENV === "development";

export class AppLogger {
  private static _logger = pino({
    level: "info",
    ...(isDevelopment && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
        },
      },
    }),
  });

  static info(message: string) {
    this._logger.info(message);
  }

  static error(message: string) {
    this._logger.error(message);
  }
}
