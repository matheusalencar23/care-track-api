import { Router } from "express";
import { AppError } from "../shared/appError";

const router = Router();

router.post("/", (req, res, next) => {
  return next(new AppError("TESTE ERRO", 404));
});

export default router;
