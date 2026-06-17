import { Router } from "express";
import { AppError } from "../shared/appError";
import { UserController } from "../controllers/userController";
import { RequestValidation } from "../middlewares/requestValidation";
import { SignupUserSchema } from "../schemas/signupUserSchema";

export class UserRoutes {
  private _routes: Router;

  get routes() {
    return this._routes;
  }

  constructor() {
    this._routes = Router();
    this._routes.use("/users", this._routes);

    this._routes.post(
      "/",
      RequestValidation.handler(SignupUserSchema),
      UserController.signup,
    );
  }
}
