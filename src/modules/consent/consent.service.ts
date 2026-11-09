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
import { AppLogger } from "../../shared/appLogger.js";
import { withOwnerScope } from "../../db/db.js";

const AGE_OF_MAJORITY = 18;
const RENEWAL_REVOCATION_REASON = "Renovação: o paciente completou 18 anos.";

const isMinorAt = (birthDate: string, date: Date) => {
  const adulthood = new Date(birthDate);
  adulthood.setUTCFullYear(adulthood.getUTCFullYear() + AGE_OF_MAJORITY);

  return date < adulthood;
};

const needsRenewal = (consent: Consent, birthDate: string) =>
  consent.status === "active" &&
  consent.grantor === "legal_representative" &&
  isMinorAt(birthDate, consent.collectedAt) &&
  !isMinorAt(birthDate, new Date());

const toConsentResponse = (consent: Consent, birthDate: string) => ({
  id: consent.id,
  patientId: consent.patientId,
  type: consent.type,
  method: consent.method,
  grantor: consent.grantor,
  representativeName: consent.representativeName,
  collectedAt: consent.collectedAt,
  status: consent.status,
  needsRenewal: needsRenewal(consent, birthDate),
  revokedAt: consent.revokedAt,
  revocationReason: consent.revocationReason,
  createdAt: consent.createdAt,
});

const findPatientOrThrow = async (ownerId: string, patientId: string) => {
  const patient = await patientRepository.findByIdForOwner(patientId, ownerId);

  if (!patient) {
    throw new NotFoundException("PATIENT_NOT_FOUND");
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
      throw new ConflictException("PATIENT_ARCHIVED");
    }

    const collectedAt = data.collectedAt
      ? new Date(data.collectedAt)
      : new Date();

    if (
      data.grantor === "patient" &&
      isMinorAt(patient.birthDate, collectedAt)
    ) {
      throw new UnprocessableEntityException(
        "CONSENT_REQUIRES_REPRESENTATIVE",
        [],
      );
    }

    const active = await consentRepository.findActiveForUpdate(
      ownerId,
      patientId,
      data.type,
    );

    if (active && !needsRenewal(active, patient.birthDate)) {
      throw new ConflictException("CONSENT_ALREADY_ACTIVE");
    }

    if (active) {
      await consentRepository.revoke(
        active.id,
        ownerId,
        RENEWAL_REVOCATION_REASON,
      );

      await auditLogService.record({
        userId: ownerId,
        action: "consent.revoke",
        resourceType: "consent",
        resourceId: active.id,
        patientId,
      });
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

    return toConsentResponse(consent, patient.birthDate);
  });
  AppLogger.info("Consent granted", { consentId: consent.id, patientId });

  return consent;
};

export const listConsents = async (ownerId: string, patientId: string) => {
  return await withOwnerScope(ownerId, async () => {
    const patient = await findPatientOrThrow(ownerId, patientId);

    const consents = await consentRepository.listForPatient(ownerId, patientId);

    await auditLogService.record({
      userId: ownerId,
      action: "consent.list",
      resourceType: "consent",
      patientId,
    });

    return consents.map((consent) =>
      toConsentResponse(consent, patient.birthDate),
    );
  });
};

export const revokeConsent = async (
  ownerId: string,
  patientId: string,
  consentId: string,
  reason: string | undefined,
) => {
  const consent = await withOwnerScope(ownerId, async () => {
    const patient = await findPatientOrThrow(ownerId, patientId);

    const current = await consentRepository.findByIdForPatient(
      consentId,
      ownerId,
      patientId,
    );

    if (!current) {
      throw new NotFoundException("CONSENT_NOT_FOUND");
    }

    if (current.status === "revoked") {
      throw new ConflictException("CONSENT_ALREADY_REVOKED");
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

    return toConsentResponse(consent, patient.birthDate);
  });
  AppLogger.info("Consent revoked", { consentId: consent.id, patientId });

  return consent;
};

export const hasActiveConsent = async (
  ownerId: string,
  patientId: string,
  type: ConsentType,
) => {
  return await withOwnerScope(ownerId, async () => {
    const patient = await findPatientOrThrow(ownerId, patientId);
    const active = await consentRepository.findActiveForShare(
      ownerId,
      patientId,
      type,
    );

    return active !== null && !needsRenewal(active, patient.birthDate);
  });
};
