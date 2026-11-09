import {
  and,
  asc,
  count,
  eq,
  isNotNull,
  isNull,
  like,
  or,
  type SQL,
} from "drizzle-orm";
import { getDb, single } from "../../db/db.js";
import { patients } from "./patient.model.js";
import type { ListPatientsQuery, PatientData } from "./patient.schema.js";
import { escapeLike, normalizeForSearch } from "../../utils/string.utils.js";

const toFields = (data: PatientData) => ({
  name: data.name,
  searchName: normalizeForSearch(data.name),
  birthDate: data.birthDate,
  cpf: data.cpf ?? null,
  cns: data.cns ?? null,
  phone: data.phone ?? null,
});

const byIdForOwner = (id: string, ownerId: string) =>
  and(eq(patients.id, id), eq(patients.ownerId, ownerId));

export const save = async (ownerId: string, data: PatientData) => {
  return single(
    await getDb()
      .insert(patients)
      .values({ ownerId, ...toFields(data) })
      .returning(),
  );
};

export const findByIdForOwner = async (
  id: string,
  ownerId: string,
  lock?: "update" | "share",
) => {
  const query = getDb()
    .select()
    .from(patients)
    .where(byIdForOwner(id, ownerId))
    .limit(1);
  const [patient] = await (lock ? query.for(lock) : query);

  return patient ?? null;
};

export const listForOwner = async (
  ownerId: string,
  { search, status, page, limit }: ListPatientsQuery,
) => {
  const conditions: (SQL | undefined)[] = [
    eq(patients.ownerId, ownerId),
    status === "archived"
      ? isNotNull(patients.archivedAt)
      : isNull(patients.archivedAt),
  ];

  if (search) {
    const pattern = `%${escapeLike(normalizeForSearch(search))}%`;
    const digits = search.replace(/[\s.\-/]/g, "");
    const isDocument = /^\d+$/.test(digits);

    conditions.push(
      isDocument
        ? or(
            like(patients.searchName, pattern),
            eq(patients.cpf, digits),
            eq(patients.cns, digits),
          )
        : like(patients.searchName, pattern),
    );
  }

  const where = and(...conditions);

  const [items, [totalRow]] = await Promise.all([
    getDb()
      .select()
      .from(patients)
      .where(where)
      .orderBy(asc(patients.searchName), asc(patients.id))
      .limit(limit)
      .offset((page - 1) * limit),
    getDb().select({ total: count() }).from(patients).where(where),
  ]);

  return { patients: items, total: totalRow?.total ?? 0 };
};

export const update = async (
  id: string,
  ownerId: string,
  data: PatientData,
) => {
  return single(
    await getDb()
      .update(patients)
      .set(toFields(data))
      .where(byIdForOwner(id, ownerId))
      .returning(),
  );
};

export const setArchivedAt = async (
  id: string,
  ownerId: string,
  archivedAt: Date | null,
) => {
  return single(
    await getDb()
      .update(patients)
      .set({ archivedAt })
      .where(byIdForOwner(id, ownerId))
      .returning(),
  );
};
