import { count, type SQL } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTable } from "drizzle-orm/pg-core";
import pg from "pg";
import type { TestDatabaseServer } from "./globalSetup.js";

const connectionUrl = (
  server: TestDatabaseServer,
  user: string,
  password: string,
  database: string,
) => `postgres://${user}:${password}@${server.host}:${server.port}/${database}`;

export const adminUrl = (server: TestDatabaseServer, database: string) =>
  connectionUrl(server, server.adminUser, server.adminPassword, database);

export const appUrl = (server: TestDatabaseServer, database: string) =>
  connectionUrl(server, server.appUser, server.appPassword, database);

let adminPool: pg.Pool | undefined;
let adminDb: NodePgDatabase | undefined;
let appPool: pg.Pool | undefined;

export const openTestConnections = (
  server: TestDatabaseServer,
  database: string,
) => {
  adminPool = new pg.Pool({ connectionString: adminUrl(server, database) });
  adminDb = drizzle(adminPool, { casing: "snake_case" });
  appPool = new pg.Pool({ connectionString: appUrl(server, database) });
};

export const closeTestConnections = async () => {
  await adminPool?.end();
  await appPool?.end();
  adminPool = undefined;
  adminDb = undefined;
  appPool = undefined;
};

export const testDb = () => {
  if (!adminDb) {
    throw new Error("The test database is not connected");
  }

  return adminDb;
};

export const adminQuery = async (text: string, values: unknown[] = []) => {
  if (!adminPool) {
    throw new Error("The test database is not connected");
  }

  return await adminPool.query(text, values);
};

export const appClient = async () => {
  if (!appPool) {
    throw new Error("The test database is not connected");
  }

  return await appPool.connect();
};

export const countRows = async (table: PgTable, where?: SQL) => {
  const [row] = await testDb()
    .select({ total: count() })
    .from(table)
    .where(where);

  return row?.total ?? 0;
};
