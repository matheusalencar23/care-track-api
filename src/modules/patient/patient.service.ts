import type { HydratedDocument } from "mongoose";
import * as patientRepository from "./patient.repository.js";
import * as auditLogService from "../audit/auditLog.service.js";
import type { IPatient } from "./patient.model.js";
import type { ListPatientsQuery, PatientData } from "./patient.schema.js";
import {
  ConflictException,
  NotFoundException,
} from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";
import { AppLogger } from "../../shared/appLogger.js";

export const toPatientResponse = (patient: HydratedDocument<IPatient>) => ({
  id: patient.id,
  name: patient.name,
  birthDate: patient.birthDate.toISOString().slice(0, 10),
  cpf: patient.cpf,
  cns: patient.cns,
  phone: patient.phone,
  archivedAt: patient.archivedAt,
  createdAt: patient.createdAt,
  updatedAt: patient.updatedAt,
});

const findPatientOrThrow = async (ownerId: string, patientId: string) => {
  const patient = await patientRepository.findByIdForOwner(patientId, ownerId);

  if (!patient) {
    throw new NotFoundException(messages.PATIENT_NOT_FOUND);
  }

  return patient;
};

export const createPatient = async (ownerId: string, data: PatientData) => {
  const patient = await patientRepository.save(ownerId, data);

  await auditLogService.record({
    userId: ownerId,
    action: "patient.create",
    resourceType: "patient",
    resourceId: patient.id,
    patientId: patient.id,
  });
  AppLogger.info("Patient created", { patientId: patient.id });

  return toPatientResponse(patient);
};

export const listPatients = async (
  ownerId: string,
  query: ListPatientsQuery,
) => {
  const { patients, total } = await patientRepository.listForOwner(
    ownerId,
    query,
  );

  await auditLogService.record({
    userId: ownerId,
    action: "patient.list",
    resourceType: "patient",
  });

  return {
    items: patients.map(toPatientResponse),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
};

export const getPatient = async (ownerId: string, patientId: string) => {
  const patient = await findPatientOrThrow(ownerId, patientId);

  await auditLogService.record({
    userId: ownerId,
    action: "patient.read",
    resourceType: "patient",
    resourceId: patient.id,
    patientId: patient.id,
  });

  return toPatientResponse(patient);
};

export const updatePatient = async (
  ownerId: string,
  patientId: string,
  data: PatientData,
) => {
  const patient = await findPatientOrThrow(ownerId, patientId);

  if (patient.archivedAt) {
    throw new ConflictException(messages.PATIENT_ARCHIVED);
  }

  await patientRepository.update(patient, data);

  await auditLogService.record({
    userId: ownerId,
    action: "patient.update",
    resourceType: "patient",
    resourceId: patient.id,
    patientId: patient.id,
  });
  AppLogger.info("Patient updated", { patientId: patient.id });

  return toPatientResponse(patient);
};

export const archivePatient = async (ownerId: string, patientId: string) => {
  const patient = await findPatientOrThrow(ownerId, patientId);

  if (patient.archivedAt) {
    throw new ConflictException(messages.PATIENT_ALREADY_ARCHIVED);
  }

  await patientRepository.setArchivedAt(patient, new Date());

  await auditLogService.record({
    userId: ownerId,
    action: "patient.archive",
    resourceType: "patient",
    resourceId: patient.id,
    patientId: patient.id,
  });
  AppLogger.info("Patient archived", { patientId: patient.id });

  return toPatientResponse(patient);
};

export const unarchivePatient = async (ownerId: string, patientId: string) => {
  const patient = await findPatientOrThrow(ownerId, patientId);

  if (!patient.archivedAt) {
    throw new ConflictException(messages.PATIENT_NOT_ARCHIVED);
  }

  await patientRepository.setArchivedAt(patient, null);

  await auditLogService.record({
    userId: ownerId,
    action: "patient.unarchive",
    resourceType: "patient",
    resourceId: patient.id,
    patientId: patient.id,
  });
  AppLogger.info("Patient unarchived", { patientId: patient.id });

  return toPatientResponse(patient);
};
