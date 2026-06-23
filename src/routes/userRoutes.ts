import { Router } from "express";
import { schemaValidationMiddleware } from "../middlewares/schemaValidationMiddleware";
import { SignupSchema } from "../schemas/signupSchema";
import { me, signin, signup } from "../controllers/userController";
import { authenticationMiddleware } from "../middlewares/authenticationMiddleware";

const routes = Router();

routes.post("/signin", signin);
routes.post("/signup", schemaValidationMiddleware(SignupSchema), signup);
routes.get("/me", authenticationMiddleware, me);

export default routes;
