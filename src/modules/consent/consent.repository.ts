import { and, desc, eq } from "drizzle-orm";
import { getDb, single } from "../../db/db.js";
import { consents, type ConsentType } from "./consent.model.js";
import type { ConsentData } from "./consent.schema.js";

export const save = async (
  ownerId: string,
  patientId: string,
  data: ConsentData,
  collectedAt: Date,
) => {
  return single(
    await getDb()
      .insert(consents)
      .values({
        ownerId,
        patientId,
        type: data.type,
        method: data.method,
        grantor: data.grantor,
        representativeName: data.representativeName ?? null,
        collectedAt,
      })
      .returning(),
  );
};

export const listForPatient = async (ownerId: string, patientId: string) => {
  return await getDb()
    .select()
    .from(consents)
    .where(
      and(eq(consents.ownerId, ownerId), eq(consents.patientId, patientId)),
    )
    .orderBy(desc(consents.createdAt), desc(consents.id));
};

export const findByIdForPatient = async (
  id: string,
  ownerId: string,
  patientId: string,
) => {
  const [consent] = await getDb()
    .select()
    .from(consents)
    .where(
      and(
        eq(consents.id, id),
        eq(consents.ownerId, ownerId),
        eq(consents.patientId, patientId),
      ),
    )
    .limit(1);

  return consent ?? null;
};

export const findActive = async (
  ownerId: string,
  patientId: string,
  type: ConsentType,
) => {
  const [consent] = await getDb()
    .select()
    .from(consents)
    .where(
      and(
        eq(consents.ownerId, ownerId),
        eq(consents.patientId, patientId),
        eq(consents.type, type),
        eq(consents.status, "active"),
      ),
    )
    .limit(1);

  return consent ?? null;
};

export const revoke = async (
  id: string,
  ownerId: string,
  reason: string | null,
) => {
  return single(
    await getDb()
      .update(consents)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revocationReason: reason,
      })
      .where(and(eq(consents.id, id), eq(consents.ownerId, ownerId)))
      .returning(),
  );
};
