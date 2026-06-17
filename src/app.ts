import express, { Router } from "express";
import { AppError } from "./shared/appError.js";
import { UserRoutes } from "./routes/userRoutes.js";
import { ErrorHandler } from "./middlewares/errorHandler.js";
import { NotFound } from "./middlewares/notFound.js";

export class App {
  private _app = express();

  constructor() {
    this._middlewares();
    this._routes();
    this._errorHandlers();
  }

  private _middlewares() {
    this._app.use(express.json());
  }

  private _routes() {
    const routes = Router();
    routes.use("/api/v1", new UserRoutes().routes);
    this._app.use(routes);
  }

  private _errorHandlers() {
    this._app.use(NotFound.handler)
    this._app.use(ErrorHandler.handler);
  }

  run(port: number, callback: () => void) {
    this._app.listen(port, callback);
  }
}
