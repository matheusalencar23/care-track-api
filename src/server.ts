import { loadEnvFile } from "node:process";
loadEnvFile(".env");

import { App } from "./app.js";
import { AppLogger } from "./shared/appLogger.js";

const PORT = Number(process.env.PORT);

new App().run(PORT, () => {
  AppLogger.info(`Server is runnning on port ${PORT}`);
});
