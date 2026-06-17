import { Router } from "express";
import { AppError } from "../shared/appError";
import { UserController } from "../controllers/userController";

export class UserRoutes {
  private _routes: Router;

  get routes() {
    return this._routes;
  }

  constructor() {
    this._routes = Router();
    this._routes.use("/users", this._routes);

    this._routes.post("/", UserController.signup);
  }
}
