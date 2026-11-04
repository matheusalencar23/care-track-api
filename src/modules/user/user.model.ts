import { sql } from "drizzle-orm";
import { check, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { BRAZILIAN_STATES } from "../../shared/brazilianStates.js";
import { createdAt, id, timestamptz, updatedAt } from "../../db/columns.js";

export const brazilianStateEnum = pgEnum("brazilian_state", BRAZILIAN_STATES);

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text().notNull(),
    email: text().notNull().unique("users_email_unique"),
    passwordHash: text().notNull(),
    coren: text().notNull(),
    corenState: brazilianStateEnum().notNull(),
    emailVerifiedAt: timestamptz(),
    passwordChangedAt: timestamptz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("users_email_lowercase", sql`${table.email} = lower(${table.email})`),
  ],
);

export type User = typeof users.$inferSelect;
