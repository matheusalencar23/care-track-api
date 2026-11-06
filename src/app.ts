import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { CORS_ORIGIN, TRUST_PROXY } from "./config/secrets.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { noStoreMiddleware } from "./middlewares/noStore.middleware.js";
import { requestLoggerMiddleware } from "./middlewares/requestLogger.middleware.js";
import routes from "./routes.js";
import { SESSION_EXPIRES_HEADER } from "./modules/auth/session.js";

const app = express();

app.set("trust proxy", TRUST_PROXY);
app.set("etag", false);
app.use(requestLoggerMiddleware);
app.use(helmet());
app.use(noStoreMiddleware);
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    exposedHeaders: [SESSION_EXPIRES_HEADER, "X-Request-Id"],
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1", routes);

app.use(errorMiddleware);

export default app;
