import { Router } from "express";
import { AppError } from "../shared/appError";
import { requestValidation } from "../middlewares/requestValidation";
import { SignupUserSchema } from "../schemas/signupUserSchema";
import { signin, signup } from "../controllers/userController";
import { authentication } from "../middlewares/authentication";

const routes = Router();

routes.post("/signin", signin);
routes.post(
  "/signup",
  authentication,
  requestValidation(SignupUserSchema),
  signup,
);

export default routes;
