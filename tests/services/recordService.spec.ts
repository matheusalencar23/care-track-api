import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRecord,
  listRecordVersions,
  updateRecord,
  voidRecord,
} from "../../src/modules/record/record.service.js";
import * as recordRepository from "../../src/modules/record/record.repository.js";
import * as patientService from "../../src/modules/patient/patient.service.js";
import * as auditLogService from "../../src/modules/audit/auditLog.service.js";
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "../../src/shared/exceptions/index.js";
import { messages } from "../../src/shared/messages.js";
import { withOwnerScope } from "../../src/db/db.js";

vi.mock("../../src/modules/record/record.repository.js", () => ({
  save: vi.fn(),
  saveVersion: vi.fn(),
  markVoided: vi.fn(),
  findByIdForPatient: vi.fn(),
  listVersions: vi.fn(),
}));

vi.mock("../../src/modules/patient/patient.service.js", () => ({
  assertPatientIsActive: vi.fn(),
}));

vi.mock("../../src/modules/audit/auditLog.service.js", () => ({
  record: vi.fn(),
}));

vi.mock(
  "../../src/db/db.js",
  async () => (await import("../helpers/dbMock.js")).dbModuleMock,
);

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

type SavedRecord = Awaited<ReturnType<typeof recordRepository.save>>;

const patientId = randomUUID();
const createdAt = new Date("2026-11-03T10:00:00.000Z");

const author = {
  id: "owner-1",
  name: "Maria Silva",
  coren: "123456",
  corenState: "SP" as const,
};

const voidedAt = new Date("2026-11-04T09:00:00.000Z");

const buildVoided = () => ({
  ...buildSaved().record,
  voidedAt,
  voidedBy: author.id,
  voidReason: "other" as const,
  voidReasonDetails: "Registro de teste",
});

const buildSaved = (version = 1, versionCreatedAt = createdAt) =>
  ({
    record: {
      id: "record-1",
      ownerId: author.id,
      patientId,
      authorId: author.id,
      createdAt,
      voidedAt: null,
      voidedBy: null,
      voidReason: null,
      voidReasonDetails: null,
    },
    version: {
      id: "version-1",
      ownerId: author.id,
      recordId: "record-1",
      version,
      content: "Paciente estável",
      authorId: author.id,
      authorName: author.name,
      authorCoren: author.coren,
      authorCorenState: author.corenState,
      reason: null,
      createdAt: versionCreatedAt,
    },
  }) as SavedRecord;

describe("recordService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createRecord", () => {
    it("should save the record in the owner scope and record the audit", async () => {
      vi.mocked(recordRepository.save).mockResolvedValue(buildSaved());

      const record = await createRecord(author, patientId, "Paciente estável");

      expect(record).toEqual({
        id: "record-1",
        patientId,
        content: "Paciente estável",
        version: 1,
        author: {
          id: author.id,
          name: author.name,
          coren: author.coren,
          corenState: author.corenState,
        },
        createdAt,
        editedAt: null,
        voidedAt: null,
        voidReason: null,
        voidReasonDetails: null,
      });
      expect(withOwnerScope).toHaveBeenCalledWith(
        "owner-1",
        expect.any(Function),
      );
      expect(patientService.assertPatientIsActive).toHaveBeenCalledWith(
        "owner-1",
        patientId,
      );
      expect(recordRepository.save).toHaveBeenCalledWith(
        "owner-1",
        patientId,
        author,
        "Paciente estável",
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "owner-1",
        action: "record.create",
        resourceType: "record",
        resourceId: "record-1",
        patientId,
      });
    });

    it("should not save the record when the patient is not found", async () => {
      vi.mocked(patientService.assertPatientIsActive).mockRejectedValueOnce(
        new NotFoundException("Paciente não encontrado!"),
      );

      await expect(
        createRecord(author, patientId, "Paciente estável"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(recordRepository.save).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it("should not save the record when the patient is archived", async () => {
      vi.mocked(patientService.assertPatientIsActive).mockRejectedValueOnce(
        new ConflictException("Paciente arquivado"),
      );

      await expect(
        createRecord(author, patientId, "Paciente estável"),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(recordRepository.save).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it("should fail when the audit fails", async () => {
      vi.mocked(recordRepository.save).mockResolvedValue(buildSaved());
      vi.mocked(auditLogService.record).mockRejectedValueOnce(
        new Error("audit failed"),
      );

      await expect(
        createRecord(author, patientId, "Paciente estável"),
      ).rejects.toThrow("audit failed");
    });
  });
  describe("updateRecord", () => {
    const editedAt = new Date("2026-11-04T08:00:00.000Z");
    const edit = { content: "Paciente estável, sem queixas", version: 1 };

    beforeEach(() => {
      vi.mocked(recordRepository.findByIdForPatient).mockResolvedValue(
        buildSaved(),
      );
      vi.mocked(recordRepository.saveVersion).mockResolvedValue({
        ...buildSaved(2, editedAt).version,
        content: edit.content,
        reason: "Complemento",
      });
    });

    it("should append a version in the owner scope and record the audit", async () => {
      const record = await updateRecord(author, patientId, "record-1", {
        ...edit,
        reason: "Complemento",
      });

      expect(record).toMatchObject({
        id: "record-1",
        content: edit.content,
        version: 2,
        createdAt,
        editedAt,
      });
      expect(withOwnerScope).toHaveBeenCalledWith(
        "owner-1",
        expect.any(Function),
      );
      expect(patientService.assertPatientIsActive).toHaveBeenCalledWith(
        "owner-1",
        patientId,
      );
      expect(recordRepository.findByIdForPatient).toHaveBeenCalledWith(
        "record-1",
        "owner-1",
        patientId,
      );
      expect(recordRepository.saveVersion).toHaveBeenCalledWith(
        "owner-1",
        "record-1",
        author,
        edit.content,
        "Complemento",
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "owner-1",
        action: "record.update",
        resourceType: "record",
        resourceId: "record-1",
        patientId,
      });
    });

    it("should save a version without reason when none is given", async () => {
      await updateRecord(author, patientId, "record-1", edit);

      expect(recordRepository.saveVersion).toHaveBeenCalledWith(
        "owner-1",
        "record-1",
        author,
        edit.content,
        null,
      );
    });

    it("should not edit when the patient is not active", async () => {
      vi.mocked(patientService.assertPatientIsActive).mockRejectedValueOnce(
        new ConflictException("Paciente arquivado"),
      );

      await expect(
        updateRecord(author, patientId, "record-1", edit),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(recordRepository.saveVersion).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the record is not found", async () => {
      vi.mocked(recordRepository.findByIdForPatient).mockResolvedValue(null);

      const promise = updateRecord(author, patientId, "record-1", edit);

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(promise).rejects.toThrow(messages.RECORD_NOT_FOUND);
      expect(recordRepository.saveVersion).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when the record is voided", async () => {
      vi.mocked(recordRepository.findByIdForPatient).mockResolvedValue({
        ...buildSaved(),
        record: buildVoided(),
      });

      const promise = updateRecord(author, patientId, "record-1", edit);

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow(messages.RECORD_VOIDED);
      expect(recordRepository.saveVersion).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when the edit is based on an outdated version", async () => {
      vi.mocked(recordRepository.findByIdForPatient).mockResolvedValue(
        buildSaved(3),
      );

      const promise = updateRecord(author, patientId, "record-1", edit);

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow(messages.RECORD_VERSION_OUTDATED);
      expect(recordRepository.saveVersion).not.toHaveBeenCalled();
    });

    it("should throw UnprocessableEntityException when the content does not change", async () => {
      const promise = updateRecord(author, patientId, "record-1", {
        content: "Paciente estável",
        version: 1,
      });

      await expect(promise).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      await expect(promise).rejects.toThrow(messages.RECORD_CONTENT_UNCHANGED);
      expect(recordRepository.saveVersion).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe("listRecordVersions", () => {
    it("should list the versions newest first and record the audit", async () => {
      const saved = buildSaved();
      vi.mocked(recordRepository.findByIdForPatient).mockResolvedValue(saved);
      vi.mocked(recordRepository.listVersions).mockResolvedValue([
        saved.version,
      ]);

      const versions = await listRecordVersions(
        "owner-1",
        patientId,
        "record-1",
      );

      expect(versions).toEqual([
        {
          version: 1,
          content: "Paciente estável",
          reason: null,
          author: {
            id: author.id,
            name: author.name,
            coren: author.coren,
            corenState: author.corenState,
          },
          createdAt,
        },
      ]);
      expect(withOwnerScope).toHaveBeenCalledWith(
        "owner-1",
        expect.any(Function),
      );
      expect(recordRepository.listVersions).toHaveBeenCalledWith(
        "owner-1",
        "record-1",
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "owner-1",
        action: "record.list_versions",
        resourceType: "record",
        resourceId: "record-1",
        patientId,
      });
    });

    it("should throw NotFoundException without recording when the record is not found", async () => {
      vi.mocked(recordRepository.findByIdForPatient).mockResolvedValue(null);

      await expect(
        listRecordVersions("owner-1", patientId, "record-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });
  describe("voidRecord", () => {
    const data = { reason: "other" as const, details: "Registro de teste" };

    beforeEach(() => {
      vi.mocked(recordRepository.findByIdForPatient).mockResolvedValue(
        buildSaved(),
      );
      vi.mocked(recordRepository.markVoided).mockResolvedValue(buildVoided());
    });

    it("should void the record in the owner scope and record the audit", async () => {
      const record = await voidRecord("owner-1", patientId, "record-1", data);

      expect(record).toMatchObject({
        id: "record-1",
        content: "Paciente estável",
        voidedAt,
        voidReason: "other",
        voidReasonDetails: "Registro de teste",
      });
      expect(withOwnerScope).toHaveBeenCalledWith(
        "owner-1",
        expect.any(Function),
      );
      expect(patientService.assertPatientIsActive).toHaveBeenCalledWith(
        "owner-1",
        patientId,
      );
      expect(recordRepository.markVoided).toHaveBeenCalledWith(
        "record-1",
        "owner-1",
        "owner-1",
        "other",
        "Registro de teste",
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "owner-1",
        action: "record.void",
        resourceType: "record",
        resourceId: "record-1",
        patientId,
      });
    });

    it("should save no details when none are given", async () => {
      await voidRecord("owner-1", patientId, "record-1", {
        reason: "duplicate",
      });

      expect(recordRepository.markVoided).toHaveBeenCalledWith(
        "record-1",
        "owner-1",
        "owner-1",
        "duplicate",
        null,
      );
    });

    it("should not void when the patient is not active", async () => {
      vi.mocked(patientService.assertPatientIsActive).mockRejectedValueOnce(
        new ConflictException("Paciente arquivado"),
      );

      await expect(
        voidRecord("owner-1", patientId, "record-1", data),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(recordRepository.markVoided).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the record is not found", async () => {
      vi.mocked(recordRepository.findByIdForPatient).mockResolvedValue(null);

      await expect(
        voidRecord("owner-1", patientId, "record-1", data),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(recordRepository.markVoided).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when the record is already voided", async () => {
      vi.mocked(recordRepository.findByIdForPatient).mockResolvedValue({
        ...buildSaved(),
        record: buildVoided(),
      });

      const promise = voidRecord("owner-1", patientId, "record-1", data);

      await expect(promise).rejects.toThrow(messages.RECORD_ALREADY_VOIDED);
      expect(recordRepository.markVoided).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when another request voided it first", async () => {
      vi.mocked(recordRepository.markVoided).mockResolvedValue(null);

      await expect(
        voidRecord("owner-1", patientId, "record-1", data),
      ).rejects.toThrow(messages.RECORD_ALREADY_VOIDED);
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });
});
