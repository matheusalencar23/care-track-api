import { Router } from "express";
import userRoutes from "./modules/user/user.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import patientRoutes from "./modules/patient/patient.routes.js";
import { isDbHealthy } from "./db/db.js";
import { APP_VERSION } from "./config/appInfo.js";
import { generalLimiter } from "./middlewares/rateLimit.middleware.js";

const routes = Router();

routes.use("/users", generalLimiter, userRoutes);
routes.use("/auth", generalLimiter, authRoutes);
routes.use("/patients", generalLimiter, patientRoutes);

routes.get("/health", async (_req, res) => {
  const isDbConnected = await isDbHealthy();

  return res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? "ok" : "degraded",
    db: isDbConnected ? "connected" : "disconnected",
    version: APP_VERSION,
  });
});

export default routes;
