import { Router } from "express";
import { AppError } from "../shared/appError";
import { requestValidation } from "../middlewares/requestValidation";
import { SignupUserSchema } from "../schemas/signupUserSchema";
import { signup } from "../controllers/userController";

const routes = Router();

routes.post("/", requestValidation(SignupUserSchema), signup);

export default routes;
