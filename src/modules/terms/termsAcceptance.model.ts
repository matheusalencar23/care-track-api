import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "../../db/columns.js";
import { users } from "../user/user.model.js";

export const termsAcceptances = pgTable(
  "terms_acceptances",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    termsVersion: text().notNull(),
    acceptedAt: createdAt(),
  },
  (table) => [index().on(table.userId, table.acceptedAt.desc())],
);

export type TermsAcceptance = typeof termsAcceptances.$inferSelect;
