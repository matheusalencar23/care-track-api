import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { GenericContainer, Wait } from "testcontainers";
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
  const [container, storage] = await Promise.all([
    new PostgreSqlContainer("postgres:18-alpine").start(),
    new GenericContainer("chrislusf/seaweedfs:4.50")
      .withCommand(["mini", "-dir=/data"])
      .withEnvironment({
        AWS_ACCESS_KEY_ID: "test-access-key",
        AWS_SECRET_ACCESS_KEY: "test-secret-key",
        S3_BUCKET: "care-track-files",
      })
      .withExposedPorts(8333)
      .withWaitStrategy(Wait.forLogMessage("All enabled components"))
      .start(),
  ]);

  process.env["S3_ENDPOINT"] =
    `http://${storage.getHost()}:${storage.getMappedPort(8333)}`;

  const storageClient = new S3Client({
    endpoint: process.env["S3_ENDPOINT"],
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    },
  });
  await storageClient.send(
    new PutObjectCommand({
      Bucket: "care-track-files",
      Key: "first-write",
      Body: "first-write",
    }),
  );
  storageClient.destroy();

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
    await Promise.all([container.stop(), storage.stop()]);
  };
}
