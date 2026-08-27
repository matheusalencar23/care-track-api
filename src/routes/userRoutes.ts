import { Router } from "express";
import { schemaValidationMiddleware } from "../middlewares/schemaValidationMiddleware.js";
import { SignupSchema } from "../schemas/signupSchema.js";
import { me, signin, signup } from "../controllers/userController.js";
import { authenticationMiddleware } from "../middlewares/authenticationMiddleware.js";
import { SigninSchema } from "../schemas/signinSchema.js";

const routes = Router();

routes.post("/signin", schemaValidationMiddleware(SigninSchema), signin);
routes.post("/signup", schemaValidationMiddleware(SignupSchema), signup);
routes.get("/me", authenticationMiddleware, me);

export default routes;
