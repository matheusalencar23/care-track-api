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
import { duplicateKeyConstraint } from "../../utils/db.utils.js";
import { ConflictException } from "../../shared/exceptions/index.js";
import { messages, type MessageCode } from "../../shared/messages.js";

const DUPLICATE_DOCUMENTS: Record<
  string,
  { code: MessageCode; path: "cpf" | "cns" }
> = {
  patients_owner_id_cpf_unique: {
    code: "PATIENT_CPF_ALREADY_EXISTS",
    path: "cpf",
  },
  patients_owner_id_cns_unique: {
    code: "PATIENT_CNS_ALREADY_EXISTS",
    path: "cns",
  },
};

const rethrowDuplicateDocument = (err: unknown): never => {
  const constraint = duplicateKeyConstraint(err);
  const duplicate = constraint ? DUPLICATE_DOCUMENTS[constraint] : undefined;

  if (duplicate) {
    throw new ConflictException(duplicate.code, [
      {
        location: "body",
        path: duplicate.path,
        message: messages[duplicate.code],
      },
    ]);
  }

  throw err;
};

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
  try {
    return single(
      await getDb()
        .insert(patients)
        .values({ ownerId, ...toFields(data) })
        .returning(),
    );
  } catch (err) {
    return rethrowDuplicateDocument(err);
  }
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
  try {
    return single(
      await getDb()
        .update(patients)
        .set(toFields(data))
        .where(byIdForOwner(id, ownerId))
        .returning(),
    );
  } catch (err) {
    return rethrowDuplicateDocument(err);
  }
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
