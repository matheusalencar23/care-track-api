import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import routes from "./routes.js";
import { CORS_ORIGIN } from "./config/secrets.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

const app = express();

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1", routes);

app.use(errorMiddleware);

export default app;
