import { AppLogger } from "./shared/appLogger.js";
import { errorDetails } from "./shared/errorDetails.js";
import { closeDb, connectDb } from "./db/db.js";
import app from "./app.js";
import { PORT } from "./config/secrets.js";
import { closeFileProcessing } from "./modules/attachment/attachment.file.js";

const REQUEST_TIMEOUT_MS = 30 * 60 * 1000;

const bootstrap = async () => {
  try {
    await connectDb();

    const server = app.listen(PORT, () => {
      AppLogger.info(`Server is runnning on port ${PORT}`);
    });

    server.requestTimeout = REQUEST_TIMEOUT_MS;

    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      AppLogger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        await closeDb();
        await closeFileProcessing();
        AppLogger.info("Shutdown complete");
        process.exit(0);
      });

      server.closeIdleConnections();

      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    process.on("unhandledRejection", (reason) => {
      AppLogger.error("Unhandled rejection", errorDetails(reason));
    });

    process.on("uncaughtException", (err) => {
      AppLogger.error("Uncaught exception", errorDetails(err));
      setImmediate(() => process.exit(1));
    });
  } catch (err) {
    AppLogger.error("Failed to start the server", errorDetails(err));
    process.exit(1);
  }
};

bootstrap();
