import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRecord } from "../../src/modules/record/record.service.js";
import * as recordRepository from "../../src/modules/record/record.repository.js";
import * as patientService from "../../src/modules/patient/patient.service.js";
import * as auditLogService from "../../src/modules/audit/auditLog.service.js";
import {
  ConflictException,
  NotFoundException,
} from "../../src/shared/exceptions/index.js";
import { withOwnerScope } from "../../src/db/db.js";

vi.mock("../../src/modules/record/record.repository.js", () => ({
  save: vi.fn(),
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

const buildSaved = (version = 1, versionCreatedAt = createdAt) =>
  ({
    record: {
      id: "record-1",
      ownerId: author.id,
      patientId,
      authorId: author.id,
      createdAt,
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
});
