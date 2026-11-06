import { randomUUID } from "node:crypto";
import pg from "pg";
import { ipKeyGenerator } from "express-rate-limit";
import { afterAll, afterEach, beforeAll, inject, vi } from "vitest";
import {
  authLimiter,
  emailLimiter,
  generalLimiter,
} from "../../src/middlewares/rateLimit.middleware.js";
import { closeDb, connectDb } from "../../src/db/db.js";
import {
  adminQuery,
  adminUrl,
  appUrl,
  closeTestConnections,
  openTestConnections,
} from "./database.js";

vi.mock("../../src/services/email/email.service.js");

const server = inject("database");
const database = `test_${randomUUID().replaceAll("-", "")}`;

const maintenanceQuery = async (text: string) => {
  const client = new pg.Client({
    connectionString: adminUrl(server, server.maintenanceDb),
  });
  await client.connect();

  try {
    await client.query(text);
  } finally {
    await client.end();
  }
};

beforeAll(async () => {
  await maintenanceQuery(
    `CREATE DATABASE ${database} TEMPLATE ${server.templateDb}`,
  );
  await connectDb(appUrl(server, database));
  openTestConnections(server, database);
});

const LOOPBACK_KEYS = ["127.0.0.1", "::1"].map((ip) => ipKeyGenerator(ip));

afterEach(async () => {
  vi.clearAllMocks();
  for (const limiter of [generalLimiter, emailLimiter, authLimiter]) {
    for (const key of LOOPBACK_KEYS) {
      await limiter.resetKey(key);
    }
  }
  await adminQuery(`
    BEGIN;
    SET LOCAL session_replication_role = replica;
    TRUNCATE users, email_verification_tokens, password_reset_tokens,
      patients, consents, records, record_versions, audit_logs,
      terms_acceptances;
    COMMIT;
  `);
});

afterAll(async () => {
  await closeDb();
  await closeTestConnections();
  await maintenanceQuery(`DROP DATABASE ${database} WITH (FORCE)`);
});
