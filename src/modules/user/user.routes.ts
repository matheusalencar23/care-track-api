import { Router } from "express";

import { me, signin, signup } from "./user.controller.js";
import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { SigninSchema, SignupSchema } from "./user.schema.js";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";

const routes = Router();

routes.post("/signin", schemaValidationMiddleware(SigninSchema), signin);
routes.post("/signup", schemaValidationMiddleware(SignupSchema), signup);
routes.get("/me", authenticationMiddleware, me);

export default routes;
