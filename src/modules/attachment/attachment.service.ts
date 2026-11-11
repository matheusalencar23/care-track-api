import { randomUUID } from "node:crypto";
import * as attachmentRepository from "./attachment.repository.js";
import * as patientService from "../patient/patient.service.js";
import * as consentService from "../consent/consent.service.js";
import * as auditLogService from "../audit/auditLog.service.js";
import * as storageService from "../../services/storage/storage.service.js";
import * as attachmentFile from "./attachment.file.js";
import type { Attachment } from "./attachment.model.js";
import type {
  AttachmentDisposition,
  ListAttachmentsQuery,
} from "./attachment.schema.js";
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "../../shared/exceptions/index.js";
import { AppLogger } from "../../shared/appLogger.js";
import { errorDetails } from "../../shared/errorDetails.js";
import { withOwnerScope } from "../../db/db.js";

interface UploadedFile {
  path: string;
  fileName: string;
}

const expiresAt = (ttlSeconds: number) =>
  new Date(Date.now() + ttlSeconds * 1000);

export const toAttachmentResponse = (attachment: Attachment) => ({
  id: attachment.id,
  patientId: attachment.patientId,
  recordId: attachment.recordId,
  fileName: attachment.fileName,
  contentType: attachment.contentType,
  size: attachment.size,
  sha256: attachment.sha256,
  createdAt: attachment.createdAt,
});

const findOrThrow = async (
  ownerId: string,
  patientId: string,
  attachmentId: string,
) => {
  const attachment = await attachmentRepository.findByIdForPatient(
    attachmentId,
    ownerId,
    patientId,
  );

  if (!attachment) {
    throw new NotFoundException("ATTACHMENT_NOT_FOUND");
  }

  return attachment;
};

const assertImageConsent = async (
  ownerId: string,
  patientId: string,
  contentType: string,
) => {
  if (
    !attachmentFile.isImage(contentType) &&
    !attachmentFile.isVideo(contentType)
  ) {
    return;
  }

  if (
    !(await consentService.hasActiveConsent(
      ownerId,
      patientId,
      "image_capture",
    ))
  ) {
    throw new ConflictException("ATTACHMENT_CONSENT_REQUIRED");
  }
};

export const assertCanUpload = async (ownerId: string, patientId: string) => {
  await withOwnerScope(ownerId, async () => {
    await patientService.assertPatientIsActive(ownerId, patientId);
  });
};

export const createAttachment = async (
  ownerId: string,
  patientId: string,
  file: UploadedFile,
) => {
  const contentType = await attachmentFile.detectContentType(file.path);

  if (!contentType) {
    throw new UnprocessableEntityException("ATTACHMENT_TYPE_NOT_ALLOWED", []);
  }

  await assertImageConsent(ownerId, patientId, contentType);

  if (attachmentFile.isImage(contentType)) {
    try {
      await attachmentFile.removeImageMetadata(file.path);
    } catch (err) {
      AppLogger.warn("Image metadata removal failed", errorDetails(err));
      throw new UnprocessableEntityException("ATTACHMENT_CONTENT_INVALID", []);
    }
  }

  const { size, sha256 } = await attachmentFile.describeFile(file.path);
  const storageKey = `attachments/${randomUUID()}`;

  await storageService.putObject(storageKey, file.path, contentType, size);

  const attachment = await withOwnerScope(ownerId, async () => {
    await patientService.assertPatientIsActive(ownerId, patientId);
    await assertImageConsent(ownerId, patientId, contentType);

    const attachment = await attachmentRepository.save(ownerId, patientId, {
      fileName: file.fileName,
      contentType,
      size,
      sha256,
      storageKey,
    });

    await auditLogService.record({
      userId: ownerId,
      action: "attachment.upload",
      resourceType: "attachment",
      resourceId: attachment.id,
      patientId,
    });

    return attachment;
  });
  AppLogger.info("Attachment uploaded", {
    attachmentId: attachment.id,
    patientId,
  });

  return toAttachmentResponse(attachment);
};

export const listAttachments = async (
  ownerId: string,
  patientId: string,
  query: ListAttachmentsQuery,
) => {
  const { items, hasMore } = await withOwnerScope(ownerId, async () => {
    await patientService.assertPatientExists(ownerId, patientId);

    const page = await attachmentRepository.listForPatient(
      ownerId,
      patientId,
      query,
    );

    await auditLogService.record({
      userId: ownerId,
      action: "attachment.list",
      resourceType: "attachment",
      patientId,
    });

    return page;
  });

  return {
    items: items.map(toAttachmentResponse),
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  };
};

export const getDownload = async (
  ownerId: string,
  patientId: string,
  attachmentId: string,
  disposition: AttachmentDisposition = "attachment",
) => {
  const attachment = await withOwnerScope(ownerId, async () => {
    const attachment = await findOrThrow(ownerId, patientId, attachmentId);
    await assertImageConsent(ownerId, patientId, attachment.contentType);

    await auditLogService.record({
      userId: ownerId,
      action: "attachment.download",
      resourceType: "attachment",
      resourceId: attachment.id,
      patientId,
    });

    return attachment;
  });

  const downloadUrl = await storageService.createDownloadUrl(
    attachment.storageKey,
    disposition,
  );

  return {
    ...toAttachmentResponse(attachment),
    downloadUrl,
    downloadUrlExpiresAt: expiresAt(storageService.DOWNLOAD_URL_TTL_SECONDS),
  };
};

export const linkToRecord = async (
  ownerId: string,
  patientId: string,
  recordId: string,
  attachmentIds: string[],
) => {
  if (attachmentIds.length === 0) {
    return [];
  }

  const linked = await attachmentRepository.linkToRecord(
    attachmentIds,
    ownerId,
    patientId,
    recordId,
  );

  if (linked.length !== attachmentIds.length) {
    throw new ConflictException("ATTACHMENT_NOT_AVAILABLE");
  }

  await auditLogService.recordMany(
    linked.map((attachment) => ({
      userId: ownerId,
      action: "attachment.link" as const,
      resourceType: "attachment" as const,
      resourceId: attachment.id,
      patientId,
    })),
  );

  return linked;
};

export const listForRecords = async (ownerId: string, recordIds: string[]) => {
  const byRecord = new Map<string, Attachment[]>();

  if (recordIds.length === 0) {
    return byRecord;
  }

  const attachments = await attachmentRepository.listForRecords(
    ownerId,
    recordIds,
  );

  for (const attachment of attachments) {
    const recordId = attachment.recordId as string;
    byRecord.set(recordId, [...(byRecord.get(recordId) ?? []), attachment]);
  }

  return byRecord;
};
