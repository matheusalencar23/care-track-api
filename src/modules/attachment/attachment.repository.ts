import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, single } from "../../db/db.js";
import { attachments } from "./attachment.model.js";

export interface NewAttachment {
  fileName: string;
  contentType: string;
  size: number;
  sha256: string;
  storageKey: string;
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
