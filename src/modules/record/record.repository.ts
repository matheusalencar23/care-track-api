import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, single } from "../../db/db.js";
import {
  records,
  recordVersions,
  type RecordVoidReason,
} from "./record.model.js";
import type { BrazilianState } from "../../shared/brazilianStates.js";

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
  content: string,
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
  content: string,
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
