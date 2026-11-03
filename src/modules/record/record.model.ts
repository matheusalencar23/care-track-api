import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, ownerIsolationPolicy } from "../../db/columns.js";
import { patients } from "../patient/patient.model.js";
import { users } from "../user/user.model.js";

export const records = pgTable(
  "records",
  {
    id: id(),
    ownerId: uuid().notNull(),
    patientId: uuid().notNull(),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [
    unique("records_owner_id_id_unique").on(table.ownerId, table.id),
    foreignKey({
      name: "records_patient_fk",
      columns: [table.ownerId, table.patientId],
      foreignColumns: [patients.ownerId, patients.id],
    }),
    index("records_timeline_index").on(
      table.ownerId,
      table.patientId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    ownerIsolationPolicy("records"),
  ],
);

export const recordVersions = pgTable(
  "record_versions",
  {
    id: id(),
    ownerId: uuid().notNull(),
    recordId: uuid().notNull(),
    version: integer().notNull().default(1),
    content: text(),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    reason: text(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "record_versions_record_fk",
      columns: [table.ownerId, table.recordId],
      foreignColumns: [records.ownerId, records.id],
    }),
    unique("record_versions_record_id_version_unique").on(
      table.recordId,
      table.version,
    ),
    check(
      "record_versions_content_not_blank",
      sql`${table.content} is null or btrim(${table.content}) <> ''`,
    ),
    check(
      "record_versions_reason_not_blank",
      sql`${table.reason} is null or btrim(${table.reason}) <> ''`,
    ),
    check(
      "record_versions_first_without_reason",
      sql`${table.version} > 1 or ${table.reason} is null`,
    ),
    ownerIsolationPolicy("record_versions"),
  ],
);

export type PatientRecord = typeof records.$inferSelect;
export type RecordVersion = typeof recordVersions.$inferSelect;
