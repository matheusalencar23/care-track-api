import type { HydratedDocument } from "mongoose";
import * as patientRepository from "./patient.repository.js";
import * as auditLogService from "../audit/auditLog.service.js";
import type { IPatient } from "./patient.model.js";
import type { ListPatientsQuery, PatientData } from "./patient.schema.js";
import { NotFoundException } from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";
import { AppLogger } from "../../shared/appLogger.js";

export const toPatientResponse = (patient: HydratedDocument<IPatient>) => ({
  id: patient.id,
  name: patient.name,
  birthDate: patient.birthDate.toISOString().slice(0, 10),
  cpf: patient.cpf,
  cns: patient.cns,
  phone: patient.phone,
  createdAt: patient.createdAt,
  updatedAt: patient.updatedAt,
});

export const createPatient = async (nurseId: string, data: PatientData) => {
  const patient = await patientRepository.save(nurseId, data);

  await auditLogService.record({
    userId: nurseId,
    action: "patient.create",
    resourceType: "patient",
    resourceId: patient.id,
    patientId: patient.id,
  });
  AppLogger.info("Patient created", { patientId: patient.id });

  return toPatientResponse(patient);
};

export const listPatients = async (
  nurseId: string,
  query: ListPatientsQuery,
) => {
  const { patients, total } = await patientRepository.listForNurse(
    nurseId,
    query,
  );

  await auditLogService.record({
    userId: nurseId,
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

export const getPatient = async (nurseId: string, patientId: string) => {
  const patient = await patientRepository.findByIdForNurse(patientId, nurseId);

  if (!patient) {
    throw new NotFoundException(messages.PATIENT_NOT_FOUND);
  }

  await auditLogService.record({
    userId: nurseId,
    action: "patient.read",
    resourceType: "patient",
    resourceId: patient.id,
    patientId: patient.id,
  });

  return toPatientResponse(patient);
};

export const updatePatient = async (
  nurseId: string,
  patientId: string,
  data: PatientData,
) => {
  const patient = await patientRepository.updateForNurse(
    patientId,
    nurseId,
    data,
  );

  if (!patient) {
    throw new NotFoundException(messages.PATIENT_NOT_FOUND);
  }

  await auditLogService.record({
    userId: nurseId,
    action: "patient.update",
    resourceType: "patient",
    resourceId: patient.id,
    patientId: patient.id,
  });
  AppLogger.info("Patient updated", { patientId: patient.id });

  return toPatientResponse(patient);
};
