import { Router } from "express";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";
import { SigninSchema } from "../user/user.schema.js";
import { authenticationMiddleware } from "./auth.middleware.js";
import {
  authLimiter,
  emailLimiter,
  generalLimiter,
  userLimiter,
} from "../../middlewares/rateLimit.middleware.js";
import { ForgotPasswordSchema, ResetPasswordSchema } from "./auth.schema.js";
import * as authController from "./auth.controller.js";

const routes = Router();

routes.post(
  "/signin",
  generalLimiter,
  authLimiter,
  schemaValidationMiddleware(SigninSchema),
  authController.signin,
);

routes.post(
  "/forgot-password",
  generalLimiter,
  emailLimiter,
  schemaValidationMiddleware(ForgotPasswordSchema),
  authController.forgotPassword,
);

routes.post(
  "/reset-password",
  generalLimiter,
  authLimiter,
  schemaValidationMiddleware(ResetPasswordSchema),
  authController.resetPassword,
);

routes.post(
  "/signout",
  authenticationMiddleware,
  userLimiter,
  authController.signout,
);

routes.get("/me", authenticationMiddleware, userLimiter, authController.me);

export default routes;
