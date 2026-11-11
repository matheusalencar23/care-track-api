import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, ownerIsolationPolicy } from "../../db/columns.js";
import { patients } from "../patient/patient.model.js";
import { records } from "../record/record.model.js";
import { users } from "../user/user.model.js";

export const ATTACHMENT_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const attachments = pgTable(
  "attachments",
  {
    id: id(),
    ownerId: uuid().notNull(),
    patientId: uuid().notNull(),
    recordId: uuid(),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    fileName: text().notNull(),
    contentType: text().notNull(),
    size: bigint({ mode: "number" }).notNull(),
    storageKey: text().notNull(),
    thumbnailStorageKey: text(),
    sha256: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("attachments_storage_key_unique").on(table.storageKey),
    unique("attachments_thumbnail_storage_key_unique").on(
      table.thumbnailStorageKey,
    ),
    foreignKey({
      name: "attachments_patient_fk",
      columns: [table.ownerId, table.patientId],
      foreignColumns: [patients.ownerId, patients.id],
    }),
    foreignKey({
      name: "attachments_record_fk",
      columns: [table.ownerId, table.patientId, table.recordId],
      foreignColumns: [records.ownerId, records.patientId, records.id],
    }),
    index("attachments_record_index").on(table.ownerId, table.recordId),
    index("attachments_patient_list_index")
      .on(
        table.ownerId,
        table.patientId,
        table.createdAt.desc(),
        table.id.desc(),
      )
      .where(sql`${table.recordId} is not null`),
    check("attachments_size_positive", sql`${table.size} > 0`),
    check(
      "attachments_thumbnail_only_images",
      sql`${table.thumbnailStorageKey} is null or ${table.contentType} like 'image/%'`,
    ),
    check(
      "attachments_file_name_not_blank",
      sql`btrim(${table.fileName}) <> ''`,
    ),
    ownerIsolationPolicy("attachments"),
  ],
);

export type Attachment = typeof attachments.$inferSelect;
