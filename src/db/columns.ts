import { sql } from "drizzle-orm";
import { pgPolicy, pgRole, timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);

export const timestamptz = () => timestamp({ withTimezone: true });

export const createdAt = () => timestamptz().notNull().defaultNow();

export const updatedAt = () =>
  timestamptz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const appRole = pgRole("care_track_app").existing();

export const ownerIsolationPolicy = (table: string) =>
  pgPolicy(`${table}_owner_isolation`, {
    as: "permissive",
    for: "all",
    to: appRole,
    using: sql`owner_id = app_current_owner_id()`,
    withCheck: sql`owner_id = app_current_owner_id()`,
  });
