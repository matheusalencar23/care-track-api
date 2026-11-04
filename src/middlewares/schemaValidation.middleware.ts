import { NextFunction, Request, Response } from "express";
import z, { ZodError, ZodObject } from "zod";
import { AppLogger } from "../shared/appLogger.js";
import { UnprocessableEntityException } from "../shared/exceptions/index.js";
import { messages } from "../shared/messages.js";

export const schemaValidationMiddleware = (schema: ZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        AppLogger.error(z.prettifyError(err));
        return next(
          new UnprocessableEntityException(
            messages.VALIDATION_FAILED,
            err.issues.map((issue) => issue.message),
          ),
        );
      }
      next(err);
    }
  };
};
