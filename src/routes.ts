import { Router } from "express";
import userRoutes from "./modules/user/user.routes.js";

const routes = Router();

routes.use("/users", userRoutes);

routes.get("/health", (_req, res) => {
  return res.status(200).json({
    status: "ok",
  });
});

export default routes;
