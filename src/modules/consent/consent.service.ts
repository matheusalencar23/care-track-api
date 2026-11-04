import * as consentRepository from "./consent.repository.js";
import * as patientRepository from "../patient/patient.repository.js";
import * as auditLogService from "../audit/auditLog.service.js";
import type { Consent, ConsentType } from "./consent.model.js";
import type { ConsentData } from "./consent.schema.js";
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";
import { AppLogger } from "../../shared/appLogger.js";
import { withOwnerScope } from "../../db/db.js";

const AGE_OF_MAJORITY = 18;

export const toConsentResponse = (consent: Consent) => ({
  id: consent.id,
  patientId: consent.patientId,
  type: consent.type,
  method: consent.method,
  grantor: consent.grantor,
  representativeName: consent.representativeName,
  collectedAt: consent.collectedAt,
  status: consent.status,
  revokedAt: consent.revokedAt,
  revocationReason: consent.revocationReason,
  createdAt: consent.createdAt,
});

const isMinorAt = (birthDate: string, date: Date) => {
  const adulthood = new Date(birthDate);
  adulthood.setUTCFullYear(adulthood.getUTCFullYear() + AGE_OF_MAJORITY);

  return date < adulthood;
};

const findPatientOrThrow = async (ownerId: string, patientId: string) => {
  const patient = await patientRepository.findByIdForOwner(patientId, ownerId);

  if (!patient) {
    throw new NotFoundException(messages.PATIENT_NOT_FOUND);
  }

  return patient;
};

export const grantConsent = async (
  ownerId: string,
  patientId: string,
  data: ConsentData,
) => {
  const consent = await withOwnerScope(ownerId, async () => {
    const patient = await findPatientOrThrow(ownerId, patientId);

    if (patient.archivedAt) {
      throw new ConflictException(messages.PATIENT_ARCHIVED);
    }

    const collectedAt = data.collectedAt
      ? new Date(data.collectedAt)
      : new Date();

    if (
      data.grantor === "patient" &&
      isMinorAt(patient.birthDate, collectedAt)
    ) {
      throw new UnprocessableEntityException(
        messages.CONSENT_REQUIRES_REPRESENTATIVE,
        [],
      );
    }

    if (await consentRepository.findActive(ownerId, patientId, data.type)) {
      throw new ConflictException(messages.CONSENT_ALREADY_ACTIVE);
    }

    const consent = await consentRepository.save(
      ownerId,
      patientId,
      data,
      collectedAt,
    );

    await auditLogService.record({
      userId: ownerId,
      action: "consent.grant",
      resourceType: "consent",
      resourceId: consent.id,
      patientId,
    });

    return consent;
  });
  AppLogger.info("Consent granted", { consentId: consent.id, patientId });

  return toConsentResponse(consent);
};

export const listConsents = async (ownerId: string, patientId: string) => {
  const consents = await withOwnerScope(ownerId, async () => {
    await findPatientOrThrow(ownerId, patientId);

    const consents = await consentRepository.listForPatient(ownerId, patientId);

    await auditLogService.record({
      userId: ownerId,
      action: "consent.list",
      resourceType: "consent",
      patientId,
    });

    return consents;
  });

  return consents.map(toConsentResponse);
};

export const revokeConsent = async (
  ownerId: string,
  patientId: string,
  consentId: string,
  reason: string | undefined,
) => {
  const consent = await withOwnerScope(ownerId, async () => {
    await findPatientOrThrow(ownerId, patientId);

    const current = await consentRepository.findByIdForPatient(
      consentId,
      ownerId,
      patientId,
    );

    if (!current) {
      throw new NotFoundException(messages.CONSENT_NOT_FOUND);
    }

    if (current.status === "revoked") {
      throw new ConflictException(messages.CONSENT_ALREADY_REVOKED);
    }

    const consent = await consentRepository.revoke(
      consentId,
      ownerId,
      reason || null,
    );

    await auditLogService.record({
      userId: ownerId,
      action: "consent.revoke",
      resourceType: "consent",
      resourceId: consent.id,
      patientId,
    });

    return consent;
  });
  AppLogger.info("Consent revoked", { consentId: consent.id, patientId });

  return toConsentResponse(consent);
};

export const hasActiveConsent = async (
  ownerId: string,
  patientId: string,
  type: ConsentType,
) => {
  return await withOwnerScope(
    ownerId,
    async () =>
      (await consentRepository.findActive(ownerId, patientId, type)) !== null,
  );
};
