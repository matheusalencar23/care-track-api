import type { HydratedDocument, QueryFilter } from "mongoose";
import Patient, { type IPatient } from "./patient.model.js";
import type { ListPatientsQuery, PatientData } from "./patient.schema.js";
import { escapeRegex, normalizeForSearch } from "../../utils/string.utils.js";

const toFields = (data: PatientData) => ({
  name: data.name,
  birthDate: data.birthDate,
  cpf: data.cpf ?? null,
  cns: data.cns ?? null,
  phone: data.phone ?? null,
});

export const save = async (ownerId: string, data: PatientData) => {
  const patient = new Patient({ ownerId, ...toFields(data) });

  await patient.save();

  return patient;
};

export const findByIdForOwner = async (id: string, ownerId: string) => {
  return await Patient.findOne({ _id: id, ownerId });
};

export const listForOwner = async (
  ownerId: string,
  { search, status, page, limit }: ListPatientsQuery,
) => {
  const filter: QueryFilter<IPatient> = {
    ownerId,
    archivedAt: status === "archived" ? { $ne: null } : null,
  };

  if (search) {
    const conditions: QueryFilter<IPatient>[] = [
      { searchName: new RegExp(escapeRegex(normalizeForSearch(search))) },
    ];

    const digits = search.replace(/[\s.\-/]/g, "");
    if (/^\d+$/.test(digits)) {
      conditions.push({ cpf: digits }, { cns: digits });
    }

    filter.$or = conditions;
  }

  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .sort({ searchName: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Patient.countDocuments(filter),
  ]);

  return { patients, total };
};

export const update = async (
  patient: HydratedDocument<IPatient>,
  data: PatientData,
) => {
  patient.set(toFields(data));
  await patient.save();

  return patient;
};

export const setArchivedAt = async (
  patient: HydratedDocument<IPatient>,
  archivedAt: Date | null,
) => {
  patient.archivedAt = archivedAt;
  await patient.save();

  return patient;
};
