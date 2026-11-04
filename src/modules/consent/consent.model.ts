import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  id,
  ownerIsolationPolicy,
  timestamptz,
  updatedAt,
} from "../../db/columns.js";
import { patients } from "../patient/patient.model.js";

export const CONSENT_TYPES = ["image_capture"] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_METHODS = ["written", "verbal"] as const;

export type ConsentMethod = (typeof CONSENT_METHODS)[number];

export const CONSENT_GRANTORS = ["patient", "legal_representative"] as const;

export type ConsentGrantor = (typeof CONSENT_GRANTORS)[number];

export const CONSENT_STATUSES = ["active", "revoked"] as const;

export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const consentTypeEnum = pgEnum("consent_type", CONSENT_TYPES);
export const consentMethodEnum = pgEnum("consent_method", CONSENT_METHODS);
export const consentGrantorEnum = pgEnum("consent_grantor", CONSENT_GRANTORS);
export const consentStatusEnum = pgEnum("consent_status", CONSENT_STATUSES);

export const consents = pgTable(
  "consents",
  {
    id: id(),
    ownerId: uuid().notNull(),
    patientId: uuid().notNull(),
    type: consentTypeEnum().notNull(),
    method: consentMethodEnum().notNull(),
    grantor: consentGrantorEnum().notNull(),
    representativeName: text(),
    collectedAt: timestamptz().notNull(),
    status: consentStatusEnum().notNull().default("active"),
    revokedAt: timestamptz(),
    revocationReason: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "consents_patient_fk",
      columns: [table.ownerId, table.patientId],
      foreignColumns: [patients.ownerId, patients.id],
    }),
    uniqueIndex("consents_one_active_per_type")
      .on(table.ownerId, table.patientId, table.type)
      .where(sql`${table.status} = 'active'`),
    index().on(table.ownerId, table.patientId, table.createdAt.desc()),
    check(
      "consents_representative_name",
      sql`(${table.grantor} = 'legal_representative') = (${table.representativeName} is not null)`,
    ),
    check(
      "consents_revocation",
      sql`(${table.status} = 'revoked') = (${table.revokedAt} is not null)`,
    ),
    ownerIsolationPolicy("consents"),
  ],
);

export type Consent = typeof consents.$inferSelect;
