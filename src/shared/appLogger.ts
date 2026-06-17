import pino from "pino";

export class AppLogger {
  private static _logger = pino({
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  });

  static info(message: string) {
    this._logger.info(message);
  }

  static error(message: string) {
    this._logger.error(message);
  }
}
