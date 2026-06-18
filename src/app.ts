import express, { Router } from "express";
import { errorMiddleware } from "./middlewares/errorMiddleware.js";
import routes from "./routes/index.js";

const app = express();

app.use(express.json());

app.use("/api/v1", routes);

app.use(errorMiddleware);

export default app;
