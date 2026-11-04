import { date, index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import {
  createdAt,
  id,
  ownerIsolationPolicy,
  timestamptz,
  updatedAt,
} from "../../db/columns.js";
import { users } from "../user/user.model.js";

export const patients = pgTable(
  "patients",
  {
    id: id(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    searchName: text().notNull(),
    birthDate: date({ mode: "string" }).notNull(),
    cpf: text(),
    cns: text(),
    phone: text(),
    archivedAt: timestamptz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("patients_owner_id_id_unique").on(table.ownerId, table.id),
    unique("patients_owner_id_cpf_unique").on(table.ownerId, table.cpf),
    unique("patients_owner_id_cns_unique").on(table.ownerId, table.cns),
    index().on(table.ownerId, table.searchName, table.id),
    ownerIsolationPolicy("patients"),
  ],
);

export type Patient = typeof patients.$inferSelect;
