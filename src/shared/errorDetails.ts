import { DrizzleQueryError } from "drizzle-orm/errors";
import pg from "pg";

const stackFrames = (err: Error) =>
  err.stack
    ?.split("\n")
    .filter((line) => line.trimStart().startsWith("at "))
    .join("\n");

const databaseErrorDetails = (err: pg.DatabaseError) => ({
  code: err.code,
  message: err.message,
  table: err.table,
  column: err.column,
  constraint: err.constraint,
});

export const errorDetails = (err: unknown): Record<string, unknown> => {
  if (err instanceof DrizzleQueryError) {
    return {
      error: "DrizzleQueryError",
      query: err.query,
      ...(err.cause instanceof pg.DatabaseError &&
        databaseErrorDetails(err.cause)),
      stack: stackFrames(err),
    };
  }

  if (err instanceof pg.DatabaseError) {
    return {
      error: "DatabaseError",
      ...databaseErrorDetails(err),
      stack: stackFrames(err),
    };
  }

  if (err instanceof Error) {
    return { error: err.name, message: err.message, stack: err.stack };
  }

  return { error: String(err) };
};
