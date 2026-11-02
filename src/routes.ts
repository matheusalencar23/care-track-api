import { Router } from "express";
import userRoutes from "./modules/user/user.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import mongoose from "mongoose";
import { APP_VERSION } from "./config/appInfo.js";
import {
  authLimiter,
  generalLimiter,
} from "./middlewares/rateLimit.middleware.js";

const routes = Router();

routes.use("/users", generalLimiter, userRoutes);
routes.use("/auth", authLimiter, authRoutes);

routes.get("/health", (_req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  return res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? "ok" : "degraded",
    db: isDbConnected ? "connected" : "disconnected",
    version: APP_VERSION,
  });
});

export default routes;
