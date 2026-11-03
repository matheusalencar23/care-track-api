import * as recordRepository from "./record.repository.js";
import * as patientService from "../patient/patient.service.js";
import * as auditLogService from "../audit/auditLog.service.js";
import type { PatientRecord, RecordVersion } from "./record.model.js";
import type { RecordAuthor } from "./record.repository.js";
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
