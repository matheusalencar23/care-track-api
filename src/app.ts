import express from "express";
import router from "./routes/index.js";
import { errorHandler } from "./shared/errorHandler.js";

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
    this._app.use("/api/v1", router);
  }

  private _errorHandler() {
    this._app.use(errorHandler);
  }

  run(callback: () => void) {
    this._app.listen(3000, callback);
  }
}
