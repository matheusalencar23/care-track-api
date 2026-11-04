import * as patientRepository from "./patient.repository.js";
import * as auditLogService from "../audit/auditLog.service.js";
import type { Patient } from "./patient.model.js";
import type { ListPatientsQuery, PatientData } from "./patient.schema.js";
import {
  ConflictException,
  NotFoundException,
} from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";
import { AppLogger } from "../../shared/appLogger.js";
import { withOwnerScope } from "../../db/db.js";

export const toPatientResponse = (patient: Patient) => ({
  id: patient.id,
  name: patient.name,
  birthDate: patient.birthDate,
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

export const assertPatientExists = async (
  ownerId: string,
  patientId: string,
) => {
  await withOwnerScope(ownerId, async () => {
    await findPatientOrThrow(ownerId, patientId);
  });
};

export const assertPatientIsActive = async (
  ownerId: string,
  patientId: string,
) => {
  await withOwnerScope(ownerId, async () => {
    const patient = await findPatientOrThrow(ownerId, patientId);

    if (patient.archivedAt) {
      throw new ConflictException(messages.PATIENT_ARCHIVED);
    }
  });
};

export const createPatient = async (ownerId: string, data: PatientData) => {
  const patient = await withOwnerScope(ownerId, async () => {
    const patient = await patientRepository.save(ownerId, data);

    await auditLogService.record({
      userId: ownerId,
      action: "patient.create",
      resourceType: "patient",
      resourceId: patient.id,
      patientId: patient.id,
    });

    return patient;
  });
  AppLogger.info("Patient created", { patientId: patient.id });

  return toPatientResponse(patient);
};

export const listPatients = async (
  ownerId: string,
  query: ListPatientsQuery,
) => {
  const { patients, total } = await withOwnerScope(ownerId, async () => {
    const result = await patientRepository.listForOwner(ownerId, query);

    if (result.patients.length === 0) {
      await auditLogService.record({
        userId: ownerId,
        action: "patient.list",
        resourceType: "patient",
      });
    } else {
      await auditLogService.recordMany(
        result.patients.map((patient) => ({
          userId: ownerId,
          action: "patient.list" as const,
          resourceType: "patient" as const,
          resourceId: patient.id,
          patientId: patient.id,
        })),
      );
    }

    return result;
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
  const patient = await withOwnerScope(ownerId, async () => {
    const patient = await findPatientOrThrow(ownerId, patientId);

    await auditLogService.record({
      userId: ownerId,
      action: "patient.read",
      resourceType: "patient",
      resourceId: patient.id,
      patientId: patient.id,
    });

    return patient;
  });

  return toPatientResponse(patient);
};

export const updatePatient = async (
  ownerId: string,
  patientId: string,
  data: PatientData,
) => {
  const patient = await withOwnerScope(ownerId, async () => {
    const current = await findPatientOrThrow(ownerId, patientId);

    if (current.archivedAt) {
      throw new ConflictException(messages.PATIENT_ARCHIVED);
    }

    const patient = await patientRepository.update(patientId, ownerId, data);

    await auditLogService.record({
      userId: ownerId,
      action: "patient.update",
      resourceType: "patient",
      resourceId: patient.id,
      patientId: patient.id,
    });

    return patient;
  });
  AppLogger.info("Patient updated", { patientId: patient.id });

  return toPatientResponse(patient);
};

export const archivePatient = async (ownerId: string, patientId: string) => {
  const patient = await withOwnerScope(ownerId, async () => {
    const current = await findPatientOrThrow(ownerId, patientId);

    if (current.archivedAt) {
      throw new ConflictException(messages.PATIENT_ALREADY_ARCHIVED);
    }

    const patient = await patientRepository.setArchivedAt(
      patientId,
      ownerId,
      new Date(),
    );

    await auditLogService.record({
      userId: ownerId,
      action: "patient.archive",
      resourceType: "patient",
      resourceId: patient.id,
      patientId: patient.id,
    });

    return patient;
  });
  AppLogger.info("Patient archived", { patientId: patient.id });

  return toPatientResponse(patient);
};

export const unarchivePatient = async (ownerId: string, patientId: string) => {
  const patient = await withOwnerScope(ownerId, async () => {
    const current = await findPatientOrThrow(ownerId, patientId);

    if (!current.archivedAt) {
      throw new ConflictException(messages.PATIENT_NOT_ARCHIVED);
    }

    const patient = await patientRepository.setArchivedAt(
      patientId,
      ownerId,
      null,
    );

    await auditLogService.record({
      userId: ownerId,
      action: "patient.unarchive",
      resourceType: "patient",
      resourceId: patient.id,
      patientId: patient.id,
    });

    return patient;
  });
  AppLogger.info("Patient unarchived", { patientId: patient.id });

  return toPatientResponse(patient);
};
