import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { AppLogger } from "../shared/appLogger";

export class NotFound {
  static handler = (req: Request, res: Response, next: NextFunction) => {
    AppLogger.error(`Path not found ${req.method} ${req.originalUrl}`);
    return res.status(404).json({
      message: "Path not found",
      method: req.method,
      url: req.originalUrl,
    });
  };
}
