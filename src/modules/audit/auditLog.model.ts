import { index, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "../../db/columns.js";
import { users } from "../user/user.model.js";

export const AUDIT_ACTIONS = [
  "auth.signin",
  "auth.signout",
  "auth.password_reset",
  "patient.create",
  "patient.list",
  "patient.read",
  "patient.update",
  "patient.archive",
  "patient.unarchive",
  "consent.grant",
  "consent.list",
  "consent.revoke",
  "record.create",
  "record.list",
  "record.update",
  "record.list_versions",
  "record.void",
  "attachment.create",
  "attachment.upload",
  "attachment.link",
  "attachment.download",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_RESOURCE_TYPES = [
  "user",
  "patient",
  "consent",
  "record",
  "attachment",
] as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

export const auditActionEnum = pgEnum("audit_action", AUDIT_ACTIONS);
export const auditResourceTypeEnum = pgEnum(
  "audit_resource_type",
  AUDIT_RESOURCE_TYPES,
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    action: auditActionEnum().notNull(),
    resourceType: auditResourceTypeEnum().notNull(),
    resourceId: uuid(),
    patientId: uuid(),
    requestId: text(),
    ip: text(),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.userId, table.createdAt.desc()),
    index().on(table.patientId, table.createdAt.desc()),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
