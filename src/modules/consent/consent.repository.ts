import type { HydratedDocument } from "mongoose";
import Consent, { type ConsentType, type IConsent } from "./consent.model.js";
import type { ConsentData } from "./consent.schema.js";

export const save = async (
  ownerId: string,
  patientId: string,
  data: ConsentData,
  collectedAt: Date,
) => {
  const consent = new Consent({
    ownerId,
    patientId,
    type: data.type,
    method: data.method,
    grantor: data.grantor,
    representativeName: data.representativeName ?? null,
    collectedAt,
  });

  await consent.save();

  return consent;
};

export const listForPatient = async (ownerId: string, patientId: string) => {
  return await Consent.find({ ownerId, patientId }).sort({
    createdAt: -1,
    _id: -1,
  });
};

export const findByIdForPatient = async (
  id: string,
  ownerId: string,
  patientId: string,
) => {
  return await Consent.findOne({ _id: id, ownerId, patientId });
};

export const findActive = async (
  ownerId: string,
  patientId: string,
  type: ConsentType,
) => {
  return await Consent.findOne({ ownerId, patientId, type, status: "active" });
};

export const revoke = async (
  consent: HydratedDocument<IConsent>,
  reason: string | null,
) => {
  consent.status = "revoked";
  consent.revokedAt = new Date();
  consent.revocationReason = reason;
  await consent.save();

  return consent;
};
