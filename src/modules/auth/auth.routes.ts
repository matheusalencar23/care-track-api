import { Router } from "express";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";
import { SigninSchema } from "../user/user.schema.js";
import { authenticationMiddleware } from "./auth.middleware.js";
import * as authController from "./auth.controller.js";

const routes = Router();

routes.post(
  "/signin",
  schemaValidationMiddleware(SigninSchema),
  authController.signin,
);

routes.get("/me", authenticationMiddleware, authController.me);

export default routes;
