import { Router } from "express";

import * as userController from "./user.controller.js";
import {
  ResendValidationEmailSchema,
  SignupSchema,
  ValidateUserSchema,
} from "./user.schema.js";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";

const routes = Router();

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

export default routes;
