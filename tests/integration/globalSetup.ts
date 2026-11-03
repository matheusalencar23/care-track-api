import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../src/db/migrator.js";

export interface TestDatabaseServer {
  host: string;
  port: number;
  adminUser: string;
  adminPassword: string;
  maintenanceDb: string;
  templateDb: string;
  appUser: string;
  appPassword: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    database: TestDatabaseServer;
  }
}

const TEMPLATE_DB = "care_track_template";
const APP_PASSWORD = "care_track_app";

export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer("postgres:18-alpine").start();

  const admin = new pg.Client({
    connectionString: container.getConnectionUri(),
  });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${TEMPLATE_DB}`);
  await admin.end();

  const templateUrl = new URL(container.getConnectionUri());
  templateUrl.pathname = `/${TEMPLATE_DB}`;
  await runMigrations(templateUrl.toString());

  const roleClient = new pg.Client({
    connectionString: templateUrl.toString(),
  });
  await roleClient.connect();
  await roleClient.query(
    `ALTER ROLE care_track_app WITH LOGIN PASSWORD '${APP_PASSWORD}'`,
  );
  await roleClient.end();

  project.provide("database", {
    host: container.getHost(),
    port: container.getPort(),
    adminUser: container.getUsername(),
    adminPassword: container.getPassword(),
    maintenanceDb: container.getDatabase(),
    templateDb: TEMPLATE_DB,
    appUser: "care_track_app",
    appPassword: APP_PASSWORD,
  });

  return async () => {
    await container.stop();
  };
}
