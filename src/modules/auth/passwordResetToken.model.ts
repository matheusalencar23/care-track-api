import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, timestamptz } from "../../db/columns.js";
import { users } from "../user/user.model.js";

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    tokenHash: text()
      .notNull()
      .unique("password_reset_tokens_token_hash_unique"),
    expiresAt: timestamptz().notNull(),
    usedAt: timestamptz(),
    createdAt: createdAt(),
  },
  (table) => [index().on(table.userId, table.createdAt.desc())],
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
