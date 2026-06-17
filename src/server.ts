import { loadEnvFile } from "node:process";
loadEnvFile(".env");

import { App } from "./app.js";
import { AppLogger } from "./shared/appLogger.js";
import { DBConnection } from "./db/db.js";

const PORT = Number(process.env.PORT);

class Server {
  async bootstrap() {
    try {
      await DBConnection.connect();

      new App().run(PORT, () => {
        AppLogger.info(`Server is runnning on port ${PORT}`);
      });
    } catch (err) {
      AppLogger.error(`Failed to start the server:  ${err}`);
      process.exit(1);
    }
  }
}

new Server().bootstrap();
