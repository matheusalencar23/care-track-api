import { NextFunction, Request, Response } from "express";

export const noStoreMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};
