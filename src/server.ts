import { AppLogger } from "./shared/appLogger.js";
import { connectDb } from "./db/db.js";
import app from "./app.js";
import { PORT } from "./config/secrets.js";
import mongoose from "mongoose";

const bootstrap = async () => {
  try {
    await connectDb();

    const server = app.listen(PORT, () => {
      AppLogger.info(`Server is runnning on port ${PORT}`);
    });

    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      AppLogger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        await mongoose.connection.close();
        AppLogger.info("Shutdown complete");
        process.exit(0);
      });

      server.closeIdleConnections();

      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    process.on("unhandledRejection", (reason) => {
      AppLogger.error(`Unhandled rejection: ${reason}`);
    });

    process.on("uncaughtException", (err) => {
      AppLogger.error(`Uncaught exception: ${err}`);
      setImmediate(() => process.exit(1));
    });
  } catch (err) {
    AppLogger.error(`Failed to start the server:  ${err}`);
    process.exit(1);
  }
};

bootstrap();
