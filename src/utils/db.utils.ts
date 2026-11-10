import { DrizzleQueryError } from "drizzle-orm/errors";
import pg from "pg";

const UNIQUE_VIOLATION = "23505";

const databaseErrorOf = (err: unknown) => {
  const cause = err instanceof DrizzleQueryError ? err.cause : err;

  return cause instanceof pg.DatabaseError ? cause : undefined;
};

export const isDuplicateKeyError = (err: unknown) => {
  return databaseErrorOf(err)?.code === UNIQUE_VIOLATION;
};

export const duplicateKeyConstraint = (err: unknown) => {
  const dbError = databaseErrorOf(err);

  return dbError?.code === UNIQUE_VIOLATION ? dbError.constraint : undefined;
};
