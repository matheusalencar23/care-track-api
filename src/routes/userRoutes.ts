import { Router } from "express";
import { schemaValidationMiddleware } from "../middlewares/schemaValidationMiddleware";
import { SignupSchema } from "../schemas/signupSchema";
import { signin, signup } from "../controllers/userController";

const routes = Router();

routes.post("/signin", signin);
routes.post("/signup", schemaValidationMiddleware(SignupSchema), signup);

export default routes;
