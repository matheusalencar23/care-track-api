import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { AppLogger } from "../shared/appLogger";

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  AppLogger.error(`Path not found ${req.method} ${req.originalUrl}`);
  return res.status(404).json({
    message: "Path not found",
    method: req.method,
    url: req.originalUrl,
  });
};
