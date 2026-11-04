import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { AppLogger } from "../shared/appLogger.js";
import { DATABASE_URL } from "../config/secrets.js";

type Database = NodePgDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbExecutor = Database | Transaction;

interface TransactionContext {
  tx: Transaction;
  ownerId: string | null;
  finished: boolean;
}

let pool: pg.Pool | undefined;
let database: Database | undefined;

const transactionStorage = new AsyncLocalStorage<TransactionContext>();

export const connectDb = async (connectionString = DATABASE_URL) => {
  pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5_000 });
  pool.on("error", (err) => {
    AppLogger.error("Idle database client error", { error: err.message });
  });
  database = drizzle(pool, { casing: "snake_case" });

  try {
    await pool.query("select 1");
    AppLogger.info("Successfully connected with database");
  } catch (err) {
    throw new Error(`Failed to connect to database: ${err}`, { cause: err });
  }
};

export const closeDb = async () => {
  await pool?.end();
  pool = undefined;
  database = undefined;
};

export const isDbHealthy = async () => {
  if (!pool) {
    return false;
  }

  try {
    await pool.query("select 1");
    return true;
  } catch {
    return false;
  }
};

const getDatabase = () => {
  if (!database) {
    throw new Error("Database is not connected");
  }

  return database;
};

export const getDb = (): DbExecutor => {
  const context = transactionStorage.getStore();

  if (!context) {
    return getDatabase();
  }

  if (context.finished) {
    throw new Error("The transaction of this context has already finished");
  }

  return context.tx;
};

const runInTransaction = async <T>(
  ownerId: string | null,
  callback: () => Promise<T>,
) => {
  return await getDatabase().transaction(async (tx) => {
    const context: TransactionContext = { tx, ownerId, finished: false };

    if (ownerId !== null) {
      await tx.execute(
        sql`select set_config('app.owner_id', ${ownerId}, true)`,
      );
    }

    try {
      return await transactionStorage.run(context, callback);
    } finally {
      context.finished = true;
    }
  });
};

export const withTransaction = async <T>(callback: () => Promise<T>) => {
  if (transactionStorage.getStore()) {
    return await callback();
  }

  return await runInTransaction(null, callback);
};

export const withOwnerScope = async <T>(
  ownerId: string,
  callback: () => Promise<T>,
) => {
  const current = transactionStorage.getStore();

  if (current) {
    if (current.ownerId !== ownerId) {
      throw new Error("A transaction cannot change its owner scope");
    }

    return await callback();
  }

  return await runInTransaction(ownerId, callback);
};

export const single = <T>(rows: T[]): T => {
  const [row] = rows;

  if (row === undefined) {
    throw new Error("The query did not return the expected row");
  }

  return row;
};
