import { Router } from "express";
import { requestValidation } from "../middlewares/requestValidation";
import { SignupSchema } from "../schemas/signupSchema";
import { signin, signup } from "../controllers/userController";

const routes = Router();

routes.post("/signin", signin);
routes.post("/signup", requestValidation(SignupSchema), signup);

export default routes;
