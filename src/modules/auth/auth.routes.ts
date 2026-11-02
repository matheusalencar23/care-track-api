import { Router } from "express";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";
import { SigninSchema } from "../user/user.schema.js";
import { authenticationMiddleware } from "./auth.middleware.js";
import { authLimiter } from "../../middlewares/rateLimit.middleware.js";
import * as authController from "./auth.controller.js";

const routes = Router();

routes.post(
  "/signin",
  authLimiter,
  schemaValidationMiddleware(SigninSchema),
  authController.signin,
);

routes.post("/signout", authenticationMiddleware, authController.signout);

routes.get("/me", authenticationMiddleware, authController.me);

export default routes;
