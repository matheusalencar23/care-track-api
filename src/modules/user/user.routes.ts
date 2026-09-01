import { Router } from "express";

import * as userController from "./user.controller.js";
import { authenticationMiddleware } from "../auth/auth.middleware.js";
import {
  ResendValidationEmailSchema,
  SigninSchema,
  SignupSchema,
  ValidateUserSchema,
} from "./user.schema.js";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";

const routes = Router();

routes.post(
  "/signin",
  schemaValidationMiddleware(SigninSchema),
  userController.signin,
);

routes.post(
  "/signup",
  schemaValidationMiddleware(SignupSchema),
  userController.signup,
);

routes.get(
  "/validate",
  schemaValidationMiddleware(ValidateUserSchema),
  userController.validate,
);

routes.post(
  "/resend",
  schemaValidationMiddleware(ResendValidationEmailSchema),
  userController.resendValidation,
);

routes.get("/me", authenticationMiddleware, userController.me);

export default routes;
