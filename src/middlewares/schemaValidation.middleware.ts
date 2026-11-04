import { NextFunction, Request, Response } from "express";
import z, { ZodError, ZodObject } from "zod";
import { AppLogger } from "../shared/appLogger.js";
import {
  UnprocessableEntityException,
  ValidationIssue,
} from "../shared/exceptions/index.js";

const toValidationIssue = (issue: z.core.$ZodIssue): ValidationIssue => {
  const [location, ...path] = issue.path.map(String);

  return {
    location: location as ValidationIssue["location"],
    path: path.join("."),
    message: issue.message,
  };
};

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
            "VALIDATION_FAILED",
            err.issues.map(toValidationIssue),
          ),
        );
      }
      next(err);
    }
  };
};
