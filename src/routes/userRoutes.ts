import { Router } from "express";
import { schemaValidationMiddleware } from "../middlewares/schemaValidationMiddleware.js";
import { SignupSchema } from "../schemas/signupSchema.js";
import { me, signin, signup } from "../controllers/userController.js";
import { authenticationMiddleware } from "../middlewares/authenticationMiddleware.js";

const routes = Router();

routes.post("/signin", signin);
routes.post("/signup", schemaValidationMiddleware(SignupSchema), signup);
routes.get("/me", authenticationMiddleware, me);

export default routes;
