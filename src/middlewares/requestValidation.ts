import { NextFunction, Request, Response } from "express";
import z, { ZodError, ZodObject } from "zod";
import { AppError } from "../shared/appError";
import { AppLogger } from "../shared/appLogger";
import { ValidationError } from "../shared/validationError";

export const requestValidation = (schema: ZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        AppLogger.error(z.prettifyError(err));
        return next(
          new ValidationError(err.issues.map((issue) => issue.message)),
        );
      }
      next(err);
    }
  };
};
