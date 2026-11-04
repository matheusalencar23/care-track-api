import * as recordRepository from "./record.repository.js";
import * as patientService from "../patient/patient.service.js";
import * as auditLogService from "../audit/auditLog.service.js";
import type { PatientRecord, RecordVersion } from "./record.model.js";
import type { RecordAuthor } from "./record.repository.js";
import type { UpdateRecordData } from "./record.schema.js";
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";
import { AppLogger } from "../../shared/appLogger.js";
import { withOwnerScope } from "../../db/db.js";

interface RecordWithVersion {
  record: PatientRecord;
  version: RecordVersion;
}

export const toRecordResponse = ({ record, version }: RecordWithVersion) => ({
  id: record.id,
  patientId: record.patientId,
  content: version.content,
  version: version.version,
  author: {
    id: version.authorId,
    name: version.authorName,
    coren: version.authorCoren,
    corenState: version.authorCorenState,
  },
  createdAt: record.createdAt,
  editedAt: version.version > 1 ? version.createdAt : null,
});

export const toRecordVersionResponse = (version: RecordVersion) => ({
  version: version.version,
  content: version.content,
  reason: version.reason,
  author: {
    id: version.authorId,
    name: version.authorName,
    coren: version.authorCoren,
    corenState: version.authorCorenState,
  },
  createdAt: version.createdAt,
});

const findRecordOrThrow = async (
  ownerId: string,
  patientId: string,
  recordId: string,
) => {
  const found = await recordRepository.findByIdForPatient(
    recordId,
    ownerId,
    patientId,
  );

  if (!found) {
    throw new NotFoundException(messages.RECORD_NOT_FOUND);
  }

  return found;
};

export const createRecord = async (
  author: RecordAuthor,
  patientId: string,
  content: string,
) => {
  const ownerId = author.id;

  const created = await withOwnerScope(ownerId, async () => {
    await patientService.assertPatientIsActive(ownerId, patientId);

    const created = await recordRepository.save(
      ownerId,
      patientId,
      author,
      content,
    );

    await auditLogService.record({
      userId: ownerId,
      action: "record.create",
      resourceType: "record",
      resourceId: created.record.id,
      patientId,
    });

    return created;
  });
  AppLogger.info("Record created", { recordId: created.record.id, patientId });

  return toRecordResponse(created);
};

export const updateRecord = async (
  author: RecordAuthor,
  patientId: string,
  recordId: string,
  data: UpdateRecordData,
) => {
  const ownerId = author.id;

  const updated = await withOwnerScope(ownerId, async () => {
    await patientService.assertPatientIsActive(ownerId, patientId);

    const { record, version: current } = await findRecordOrThrow(
      ownerId,
      patientId,
      recordId,
    );

    if (current.version !== data.version) {
      throw new ConflictException(messages.RECORD_VERSION_OUTDATED);
    }

    if (current.content === data.content) {
      throw new UnprocessableEntityException(
        messages.RECORD_CONTENT_UNCHANGED,
        [],
      );
    }

    const version = await recordRepository.saveVersion(
      ownerId,
      record.id,
      author,
      data.content,
      data.reason ?? null,
    );

    await auditLogService.record({
      userId: ownerId,
      action: "record.update",
      resourceType: "record",
      resourceId: record.id,
      patientId,
    });

    return { record, version };
  });
  AppLogger.info("Record updated", {
    recordId: updated.record.id,
    patientId,
    version: updated.version.version,
  });

  return toRecordResponse(updated);
};

export const listRecordVersions = async (
  ownerId: string,
  patientId: string,
  recordId: string,
) => {
  const versions = await withOwnerScope(ownerId, async () => {
    const { record } = await findRecordOrThrow(ownerId, patientId, recordId);

    const versions = await recordRepository.listVersions(ownerId, record.id);

    await auditLogService.record({
      userId: ownerId,
      action: "record.list_versions",
      resourceType: "record",
      resourceId: record.id,
      patientId,
    });

    return versions;
  });

  return versions.map(toRecordVersionResponse);
};
