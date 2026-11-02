import { Router } from "express";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";
import { SigninSchema } from "../user/user.schema.js";
import { authenticationMiddleware } from "./auth.middleware.js";
import {
  authLimiter,
  emailLimiter,
} from "../../middlewares/rateLimit.middleware.js";
import { ForgotPasswordSchema, ResetPasswordSchema } from "./auth.schema.js";
import * as authController from "./auth.controller.js";

const routes = Router();

routes.post(
  "/signin",
  authLimiter,
  schemaValidationMiddleware(SigninSchema),
  authController.signin,
);

routes.post(
  "/forgot-password",
  emailLimiter,
  schemaValidationMiddleware(ForgotPasswordSchema),
  authController.forgotPassword,
);

routes.post(
  "/reset-password",
  authLimiter,
  schemaValidationMiddleware(ResetPasswordSchema),
  authController.resetPassword,
);

routes.post("/signout", authenticationMiddleware, authController.signout);

routes.get("/me", authenticationMiddleware, authController.me);

export default routes;
