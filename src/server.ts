import { loadEnvFile } from "node:process";
loadEnvFile(".env");

import { AppLogger } from "./shared/appLogger.js";
import { connectDb } from "./db/db.js";
import app from "./app.js";

const PORT = Number(process.env.PORT);

const bootstrap = async () => {
  try {
    await connectDb();

    app.listen(PORT, () => {
      AppLogger.info(`Server is runnning on port ${PORT}`);
    });
  } catch (err) {
    AppLogger.error(`Failed to start the server:  ${err}`);
    process.exit(1);
  }
};

bootstrap();
