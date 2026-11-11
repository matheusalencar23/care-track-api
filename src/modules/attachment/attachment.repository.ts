import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { getDb, single } from "../../db/db.js";
import { attachments } from "./attachment.model.js";
import { records } from "../record/record.model.js";
import type { ListAttachmentsQuery } from "./attachment.schema.js";

export interface NewAttachment {
  fileName: string;
  contentType: string;
  size: number;
  sha256: string;
  storageKey: string;
  thumbnailStorageKey: string | null;
}

export const save = async (
  ownerId: string,
  patientId: string,
  data: NewAttachment,
) => {
  return single(
    await getDb()
      .insert(attachments)
      .values({ ...data, ownerId, patientId, authorId: ownerId })
      .returning(),
  );
};

export const findByIdForPatient = async (
  id: string,
  ownerId: string,
  patientId: string,
) => {
  const [attachment] = await getDb()
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, id),
        eq(attachments.ownerId, ownerId),
        eq(attachments.patientId, patientId),
      ),
    )
    .limit(1);

  return attachment ?? null;
};

export const findManyForPatient = async (
  ids: string[],
  ownerId: string,
  patientId: string,
) => {
  return await getDb()
    .select()
    .from(attachments)
    .where(
      and(
        inArray(attachments.id, ids),
        eq(attachments.ownerId, ownerId),
        eq(attachments.patientId, patientId),
      ),
    );
};

export const setThumbnail = async (
  id: string,
  ownerId: string,
  thumbnailStorageKey: string,
) => {
  const [attachment] = await getDb()
    .update(attachments)
    .set({ thumbnailStorageKey })
    .where(
      and(
        eq(attachments.id, id),
        eq(attachments.ownerId, ownerId),
        isNull(attachments.thumbnailStorageKey),
      ),
    )
    .returning({ id: attachments.id });

  return attachment ?? null;
};

export const linkToRecord = async (
  ids: string[],
  ownerId: string,
  patientId: string,
  recordId: string,
) => {
  return await getDb()
    .update(attachments)
    .set({ recordId })
    .where(
      and(
        inArray(attachments.id, ids),
        eq(attachments.ownerId, ownerId),
        eq(attachments.patientId, patientId),
        isNull(attachments.recordId),
      ),
    )
    .returning();
};

export const listForRecords = async (ownerId: string, recordIds: string[]) => {
  return await getDb()
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.ownerId, ownerId),
        inArray(attachments.recordId, recordIds),
      ),
    )
    .orderBy(asc(attachments.createdAt), asc(attachments.id));
};

export const listForPatient = async (
  ownerId: string,
  patientId: string,
  query: ListAttachmentsQuery,
) => {
  const conditions = [
    eq(attachments.ownerId, ownerId),
    eq(attachments.patientId, patientId),
    isNotNull(attachments.recordId),
    query.status === "voided"
      ? isNotNull(records.voidedAt)
      : isNull(records.voidedAt),
  ];

  if (query.cursor) {
    conditions.push(
      sql`(${attachments.createdAt}, ${attachments.id}) < (
        select cursor.created_at, cursor.id from ${attachments} as cursor
        where cursor.id = ${query.cursor}
          and cursor.owner_id = ${ownerId}
          and cursor.patient_id = ${patientId}
      )`,
    );
  }

  const rows = await getDb()
    .select(getTableColumns(attachments))
    .from(attachments)
    .innerJoin(
      records,
      and(
        eq(records.ownerId, attachments.ownerId),
        eq(records.id, attachments.recordId),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(attachments.createdAt), desc(attachments.id))
    .limit(query.limit + 1);

  return {
    items: rows.slice(0, query.limit),
    hasMore: rows.length > query.limit,
  };
};
