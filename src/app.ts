import express, { Router } from "express";
import { AppError } from "./shared/appError.js";
import { UserRoutes } from "./routes/userRoutes.js";

export class App {
  private _app = express();

  constructor() {
    this._middlewares();
    this._routes();
    this._errorHandler();
  }

  private _middlewares() {
    this._app.use(express.json());
  }

  private _routes() {
    const routes = Router();
    routes.use("/users", new UserRoutes().routes);
    routes.use("/api/v1", routes);
    this._app.use(routes);
  }

  private _errorHandler() {
    this._app.use(AppError.errorHandler);
  }

  run(port: number, callback: () => void) {
    this._app.listen(port, callback);
  }
}
