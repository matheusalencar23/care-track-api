import { Router } from "express";
import { AppError } from "../shared/appError";

export class UserRoutes {
  private _routes = Router();

  get routes() {
    return this._routes;
  }

  constructor() {
    this._routes.post("/", (req, res, next) => {
      return next(new AppError("TESTE ERRO", 404));
    });
  }
}
