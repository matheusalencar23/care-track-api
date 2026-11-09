import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, single } from "../../db/db.js";
import {
  records,
  recordVersions,
  type RecordVoidReason,
} from "./record.model.js";
import type { BrazilianState } from "../../shared/brazilianStates.js";
import type { ListRecordsQuery } from "./record.schema.js";

export interface RecordAuthor {
  id: string;
  name: string;
  coren: string;
  corenState: BrazilianState;
}

const insertVersion = async (
  ownerId: string,
  recordId: string,
  author: RecordAuthor,
  content: string | null,
  reason: string | null,
) => {
  return single(
    await getDb()
      .insert(recordVersions)
      .values({
        ownerId,
        recordId,
        content,
        reason,
        authorId: author.id,
        authorName: author.name,
        authorCoren: author.coren,
        authorCorenState: author.corenState,
      })
      .returning(),
  );
};

export const save = async (
  ownerId: string,
  patientId: string,
  author: RecordAuthor,
  content: string | null,
) => {
  const record = single(
    await getDb()
      .insert(records)
      .values({ ownerId, patientId, authorId: author.id })
      .returning(),
  );

  const version = await insertVersion(
    ownerId,
    record.id,
    author,
    content,
    null,
  );

  return { record, version };
};

export const saveVersion = async (
  ownerId: string,
  recordId: string,
  author: RecordAuthor,
  content: string,
  reason: string | null,
) => {
  return await insertVersion(ownerId, recordId, author, content, reason);
};

export const findByIdForPatient = async (
  id: string,
  ownerId: string,
  patientId: string,
) => {
  const [record] = await getDb()
    .select()
    .from(records)
    .where(
      and(
        eq(records.id, id),
        eq(records.ownerId, ownerId),
        eq(records.patientId, patientId),
      ),
    )
    .limit(1);

  if (!record) {
    return null;
  }

  const [version] = await getDb()
    .select()
    .from(recordVersions)
    .where(
      and(
        eq(recordVersions.recordId, record.id),
        eq(recordVersions.ownerId, ownerId),
      ),
    )
    .orderBy(desc(recordVersions.version))
    .limit(1);

  if (!version) {
    throw new Error("The record has no version");
  }

  return { record, version };
};

export const listVersions = async (ownerId: string, recordId: string) => {
  return await getDb()
    .select()
    .from(recordVersions)
    .where(
      and(
        eq(recordVersions.recordId, recordId),
        eq(recordVersions.ownerId, ownerId),
      ),
    )
    .orderBy(desc(recordVersions.version));
};

export const markVoided = async (
  id: string,
  ownerId: string,
  voidedBy: string,
  reason: RecordVoidReason,
  details: string | null,
) => {
  const [record] = await getDb()
    .update(records)
    .set({
      voidedAt: new Date(),
      voidedBy,
      voidReason: reason,
      voidReasonDetails: details,
    })
    .where(
      and(
        eq(records.id, id),
        eq(records.ownerId, ownerId),
        isNull(records.voidedAt),
      ),
    )
    .returning();

  return record ?? null;
};

export const listForPatient = async (
  ownerId: string,
  patientId: string,
  query: ListRecordsQuery,
) => {
  const conditions = [
    eq(records.ownerId, ownerId),
    eq(records.patientId, patientId),
    query.status === "voided"
      ? isNotNull(records.voidedAt)
      : isNull(records.voidedAt),
  ];

  if (query.cursor) {
    conditions.push(
      sql`(${records.createdAt}, ${records.id}) < (
        select cursor.created_at, cursor.id from ${records} as cursor
        where cursor.id = ${query.cursor}
          and cursor.owner_id = ${ownerId}
          and cursor.patient_id = ${patientId}
      )`,
    );
  }

  const rows = await getDb()
    .select()
    .from(records)
    .where(and(...conditions))
    .orderBy(desc(records.createdAt), desc(records.id))
    .limit(query.limit + 1);

  const page = rows.slice(0, query.limit);
  const versions =
    page.length === 0
      ? []
      : await getDb()
          .selectDistinctOn([recordVersions.recordId])
          .from(recordVersions)
          .where(
            and(
              eq(recordVersions.ownerId, ownerId),
              inArray(
                recordVersions.recordId,
                page.map((record) => record.id),
              ),
            ),
          )
          .orderBy(recordVersions.recordId, desc(recordVersions.version));

  const currentVersions = new Map(
    versions.map((version) => [version.recordId, version]),
  );

  return {
    items: page.map((record) => {
      const version = currentVersions.get(record.id);

      if (!version) {
        throw new Error("The record has no version");
      }

      return { record, version };
    }),
    hasMore: rows.length > query.limit,
  };
};
