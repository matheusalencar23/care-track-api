import { AppLogger } from "../shared/appLogger.js";
import { runMigrations } from "./migrator.js";

const connectionString = process.env["DATABASE_MIGRATION_URL"];

if (!connectionString) {
  AppLogger.error(
    "Missing required environment variable: DATABASE_MIGRATION_URL",
  );
  process.exit(1);
}

try {
  await runMigrations(connectionString);
  AppLogger.info("Database migrations applied");
} catch (err) {
  AppLogger.error("Failed to apply database migrations", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
}
