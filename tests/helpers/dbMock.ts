import { DrizzleQueryError } from "drizzle-orm/errors";
import pg from "pg";
import { vi } from "vitest";

export const dbModuleMock = {
  withTransaction: vi.fn(async (callback: () => Promise<unknown>) => {
    return await callback();
  }),
  withOwnerScope: vi.fn(
    async (_ownerId: string, callback: () => Promise<unknown>) => {
      return await callback();
    },
  ),
  getDb: vi.fn(),
  single: vi.fn(<T>(rows: T[]) => rows[0]),
};

export const uniqueViolation = (
  value = "john@example.com",
  constraint = "users_email_unique",
) => {
  const cause = new pg.DatabaseError(
    `duplicate key value violates unique constraint "${constraint}"`,
    0,
    "error",
  );
  cause.code = "23505";
  cause.constraint = constraint;
  cause.detail = `Key (email)=(${value}) already exists.`;

  return new DrizzleQueryError(
    'insert into "users" ("email") values ($1)',
    [value],
    cause,
  );
};
