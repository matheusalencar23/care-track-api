import { NextFunction, Request, Response } from "express";
import { ZodError, ZodObject } from "zod";
import { AppError } from "../shared/appError";

export class RequestValidation {
  static handler(schema: ZodObject) {
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
          return next(
            new AppError(
              "Invalid fields",
              400,
              err.issues.map((issue) => issue.message),
            ),
          );
        }
        next(err);
      }
    };
  }
}
