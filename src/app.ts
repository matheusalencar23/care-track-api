import express, { Router } from "express";
import { AppError } from "./shared/appError.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import routes from "./routes/index.js";

const app = express();

app.use(express.json());

app.use("/api/v1", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
